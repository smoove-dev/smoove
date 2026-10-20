import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isAbsolute, join, relative, resolve as resolvePath } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  AGENT_PREFIX,
  AGENT_TAB_PARAM,
  type AgentErrorBody,
  type AgentResponse,
  type BridgeHello,
  type ContextData,
  DEFAULT_SNAPSHOT_WIDTH,
  DEFAULT_TILE_WIDTH,
  type DiscoveryInfo,
  type ErrorCode,
  HEADLESS_CONNECT_MS,
  MARKS_DIR,
  MAX_SHEET_FRAMES,
  type MarkInput,
  MIN_SHEET_FRAMES,
  type RenderData,
  type RenderFormat,
  type RenderParams,
  type RenderQueued,
  type SeekParams,
  SHEETS_DIR,
  type SheetData,
  type SheetParams,
  SNAPS_DIR,
  type SnapshotData,
  type SnapshotParams,
  type StatusData,
  type StudioStatus,
  TAB_TIMEOUT_MS,
  type TabJobUpdate,
  type TabMarkClear,
  type TabMarkEvent,
  type TabMarkPost,
  type TabPresence,
  type TabRequest,
  type TabRequestType,
  type TimelineParams,
} from "../index.js";
import { removeDiscovery, writeDiscovery } from "./discovery.js";
import {
  type BrowserLauncher,
  chromeLauncher,
  type LaunchedBrowser,
  NoBrowserError,
} from "./headless.js";
import { MarkStore } from "./marks.js";
import { drawnBy, summarize, type Tab, TabList } from "./tabs.js";

export interface AgentBridgeOptions {
  /** The project root (Vite's `root`): `.smoove/` is created here. */
  root: string;
  /** Reply timeout. Default 15 seconds. */
  timeoutMs?: number;
  /**
   * After a source file changes, hold requests this long before forwarding
   * them, so the tab has received the hot update and started its rebuild.
   * Default 300 ms.
   */
  settleMs?: number;
  /** Fixed token, for tests. Default: random per bridge. */
  token?: string;
  /** Keep-alive comment interval on tab streams. Default 15 seconds. */
  pingMs?: number;
  /** Clock, for tests. */
  now?: () => number;
  /**
   * Opens the studio in a headless browser when a request needs a tab nobody
   * is watching. Default: an installed Chrome, Chromium or Edge. `false`
   * turns headless tabs off, so such requests answer `no-tab`.
   */
  launchBrowser?: BrowserLauncher | false;
  /** How long to wait for the headless tab to connect. Default 30 seconds. */
  headlessConnectMs?: number;
  /** How long a request waits for a tab that closed mid-request to reconnect. Default 5 seconds. */
  reconnectMs?: number;
}

type Next = (err?: unknown) => void;

export interface AgentBridge {
  readonly token: string;
  /** Connect-style middleware. Calls `next()` for anything outside the prefix. */
  handle(req: IncomingMessage, res: ServerResponse, next?: Next): void;
  /** Record the dev server's URL and write the discovery file. Returns its path. */
  listening(url: string): string;
  /** Tell the bridge a source file changed (see `settleMs`). */
  fileChanged(): void;
  /** Close every tab stream, fail pending requests and remove the discovery file. */
  close(): void;
  /** The connected tabs (for tests and logging). */
  tabs(): ReturnType<typeof summarize>[];
}

interface Pending {
  tab: Tab;
  type: TabRequestType;
  params: TabRequest["params"];
  settle: (status: number, body: AgentResponse<unknown>, closed?: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface RenderRecord extends RenderData {
  tab: Tab;
}

/** An answer for the agent. `closed` marks one where the tab went away before answering. */
type Out = { status: number; body: AgentResponse<unknown>; closed?: boolean };

const JSON_LIMIT = 1 << 20;
const PNG_LIMIT = 64 << 20;
const MAX_SNAPSHOT_WIDTH = 8192;
const MAX_TILE_WIDTH = 1920;
/** How long a request waits for a closed tab to reconnect before trying again anyway. */
const RECONNECT_WAIT_MS = 5000;

/**
 * The dev-server half of the bridge. Agent-facing endpoints need the per-run
 * bearer token; tab-facing ones (`tab/*`) are same-origin only. Everything
 * refuses a remote address that isn't this machine.
 *
 * Which tab answers: a request about a composition goes to a user tab already
 * showing it, else to the bridge's own headless tab, which switches to it.
 * Nothing the agent asks for changes what a user sees, except `seek`, which
 * only ever goes to a user tab.
 */
export function createAgentBridge(options: AgentBridgeOptions): AgentBridge {
  const root = options.root;
  const timeoutMs = options.timeoutMs ?? TAB_TIMEOUT_MS;
  const settleMs = options.settleMs ?? 300;
  const pingMs = options.pingMs ?? 15_000;
  const now = options.now ?? Date.now;
  const headlessConnectMs = options.headlessConnectMs ?? HEADLESS_CONNECT_MS;
  const reconnectMs = options.reconnectMs ?? RECONNECT_WAIT_MS;
  const launcher =
    options.launchBrowser === false
      ? null
      : (options.launchBrowser ?? chromeLauncher(join(root, ".smoove", "browser-profile")));
  const token = options.token ?? randomBytes(24).toString("base64url");
  // Marks the tab this bridge launches, so it never counts as a user's tab.
  const ownTabSecret = randomBytes(12).toString("base64url");
  const startedAt = new Date(now()).toISOString();
  const tabs = new TabList(now);
  const pending = new Map<string, Pending>();
  const renders = new Map<string, RenderRecord>();
  const marks = new MarkStore();
  let url: string | null = null;
  let lastChangeAt = Number.NEGATIVE_INFINITY;
  let closed = false;

  let browser: LaunchedBrowser | null = null;
  let ownedWaiters: Array<(tab: Tab) => void> = [];
  /** Called on every tab connection, for requests waiting out a reload. */
  let connectWaiters: Array<() => void> = [];

  const onExit = (): void => {
    browser?.close();
    removeDiscovery(root, token);
  };
  process.on("exit", onExit);

  const ping = setInterval(() => {
    for (const tab of tabs.all()) tab.stream.write(": ping\n\n");
  }, pingMs);
  ping.unref?.();

  function openUrl(req?: IncomingMessage): string {
    if (url) return url;
    const host = req?.headers.host;
    return host ? `http://${host}/` : "the studio dev server URL";
  }

  /** An absolute base URL for this server, for fetching from itself. */
  function baseUrl(req?: IncomingMessage): string | null {
    if (url) return url;
    const host = req?.headers.host;
    return host ? `http://${host}/` : null;
  }

  function serverStatus(req?: IncomingMessage): StatusData["server"] {
    return {
      url: openUrl(req),
      pid: process.pid,
      startedAt,
      tabs: tabs.all().map(summarize),
      mark: markSummary(),
    };
  }

  function markSummary(): StatusData["server"]["mark"] {
    const m = marks.current();
    return m ? { composition: m.composition, frame: m.frame } : null;
  }

  /** Tell tabs which mark is current, so the others drop their rectangle. */
  function broadcastMark(only?: Tab): void {
    const event: TabMarkEvent = { id: marks.current()?.id ?? null };
    for (const tab of only ? [only] : tabs.all()) sendEvent(tab, "mark", event);
  }

  // ---------------------------------------------------------------- marks

  async function markImage(req: IncomingMessage, res: ServerResponse, q: URLSearchParams) {
    const bytes = await readBody(req, PNG_LIMIT);
    const id = q.get("id") ?? "";
    if (!id || !tabs.get(q.get("tabId") ?? "")) {
      return send(res, 404, fail("bad-request", "Unknown tab or mark."));
    }
    const dir = join(root, MARKS_DIR);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, markFileName(q.get("composition") ?? "", Number(q.get("frame") ?? 0)));
    writeFileSync(path, bytes);
    marks.putImage(id, path);
    return send(res, 200, { ok: true, data: null });
  }

  async function postMark(req: IncomingMessage, res: ServerResponse) {
    const body = await readJson<TabMarkPost>(req);
    const tab = body && typeof body.tabId === "string" ? tabs.get(body.tabId) : undefined;
    const mark = body?.mark;
    if (!tab || !validMark(mark)) {
      return send(res, 400, fail("bad-request", "A mark needs a known tab and a mark object."));
    }
    const accepted = marks.set(mark, drawnBy(tab), new Date(now()).toISOString());
    // A refused resend: tell only that tab, so it drops the stale rectangle.
    broadcastMark(accepted ? undefined : tab);
    return send(res, 200, { ok: true, data: { accepted } });
  }

  async function clearMark(req: IncomingMessage, res: ServerResponse) {
    const body = await readJson<TabMarkClear>(req);
    if (!body || typeof body.id !== "string") {
      return send(res, 400, fail("bad-request", "A clear needs a mark id."));
    }
    if (marks.clear(body.id)) broadcastMark();
    return send(res, 200, { ok: true, data: null });
  }

  // ---------------------------------------------------------------- tabs

  function connectTab(req: IncomingMessage, res: ServerResponse, query: URLSearchParams): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const owned = query.get(AGENT_TAB_PARAM) === ownTabSecret;
    const tab = tabs.add({
      id: randomUUID(),
      path: query.get("path") || "/",
      visible: query.get("visible") !== "0",
      focused: query.get("focused") === "1",
      headless: owned || query.get("headless") === "1",
      owned,
      composition: query.get("composition") || null,
      stream: res,
    });
    sendEvent(tab, "hello", { tabId: tab.id });
    if (owned) {
      const waiters = ownedWaiters;
      ownedWaiters = [];
      for (const w of waiters) w(tab);
    }
    const reconnects = connectWaiters;
    connectWaiters = [];
    for (const w of reconnects) w();
    req.on("close", () => {
      if (!tabs.remove(tab.id)) return;
      for (const [id, p] of pending) {
        if (p.tab !== tab) continue;
        pending.delete(id);
        clearTimeout(p.timer);
        p.settle(
          502,
          {
            ok: false,
            error: {
              code: "tab-error",
              message: `The studio tab at ${tab.path} closed before it answered. Run the request again.`,
            },
          },
          true,
        );
      }
      for (const job of renders.values()) {
        if (job.tab !== tab || !unfinished(job)) continue;
        job.status = "error";
        job.error =
          "The studio tab that queued this render closed, so its progress can't be followed. The render may still finish on the dev server; check the studio's render queue.";
      }
    });
  }

  function sendEvent(tab: Tab, event: string, data: unknown): void {
    tab.stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  /** Hold requests briefly after a source edit, so the tab has the hot update. */
  async function settleAfterEdit(): Promise<void> {
    const wait = lastChangeAt + settleMs - now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  function forward(tab: Tab, type: TabRequestType, params: TabRequest["params"]): Promise<Out> {
    const id = randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!pending.delete(id)) return;
        sendEvent(tab, "cancel", { id });
        resolve({
          status: 504,
          body: {
            ok: false,
            error: {
              code: "tab-timeout",
              message: `The studio tab at ${tab.path} didn't answer within ${Math.round(timeoutMs / 1000)} seconds. It may still be loading the composition; check the browser console, then try again.`,
            },
            drawnBy: drawnBy(tab),
          },
        });
      }, timeoutMs);
      pending.set(id, {
        tab,
        type,
        params,
        timer,
        settle: (status, body, closed) =>
          resolve({ status, body: { ...body, drawnBy: drawnBy(tab) }, closed }),
      });
      sendEvent(tab, "request", { id, type, params } as TabRequest);
    });
  }

  /** Resolve on the next tab connection, or after `ms`. */
  function nextConnect(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(done, ms);
      function done(): void {
        clearTimeout(timer);
        connectWaiters = connectWaiters.filter((w) => w !== done);
        resolve();
      }
      connectWaiters.push(done);
    });
  }

  /**
   * Pick a tab and forward the request. A tab that reloads mid-request (a
   * fresh project's first load, where Vite reloads the page as it optimizes
   * dependencies, or a full hot reload) closes before it answers: wait for it
   * to reconnect, pick again and resend, within the reply timeout. Not for
   * render, whose first try may already have queued a job.
   */
  async function dispatch(
    type: TabRequestType,
    pick: () => Promise<{ tab: Tab; params: TabRequest["params"] } | Out>,
  ): Promise<Out> {
    const deadline = now() + timeoutMs;
    for (let attempt = 1; ; attempt++) {
      const picked = await pick();
      if ("status" in picked) return picked;
      const out = await forward(picked.tab, type, picked.params);
      const left = deadline - now();
      if (!out.closed || type === "render" || attempt >= 4 || left <= 0) return out;
      await nextConnect(Math.min(left, reconnectMs));
    }
  }

  function noTab(req: IncomingMessage, what = "No studio tab is connected."): Out {
    return {
      status: 409,
      body: fail("no-tab", `${what} Open ${openUrl(req)} in a browser, then try again.`),
    };
  }

  // ---------------------------------------------------------------- headless

  /**
   * The bridge's own headless tab, launching the browser if it isn't running.
   * Waits for the page to connect. Throws `NoBrowserError` or a timeout.
   */
  async function ownedTab(req: IncomingMessage): Promise<Tab> {
    const existing = tabs.owned();
    if (existing) return existing;
    if (!launcher) {
      throw new NoBrowserError("Headless tabs are turned off for this dev server.");
    }
    const base = baseUrl(req);
    if (!base) throw new NoBrowserError("The dev server's URL isn't known yet.");

    const connected = new Promise<Tab>((resolve, reject) => {
      const timer = setTimeout(() => {
        ownedWaiters = ownedWaiters.filter((w) => w !== onTab);
        reject(
          new NoBrowserError(
            `The headless browser didn't connect within ${Math.round(headlessConnectMs / 1000)} seconds.`,
          ),
        );
      }, headlessConnectMs);
      const onTab = (tab: Tab): void => {
        clearTimeout(timer);
        resolve(tab);
      };
      ownedWaiters.push(onTab);
    });

    if (!browser) {
      const target = new URL(base);
      target.searchParams.set(AGENT_TAB_PARAM, ownTabSecret);
      const launched = launcher(target.toString());
      browser = launched;
      void launched.exited.then(() => {
        if (browser === launched) browser = null;
      });
    }
    return connected;
  }

  /**
   * Which tab answers a request, and whether it may switch compositions.
   * `composition` is the one the request names, if any.
   */
  async function target(
    req: IncomingMessage,
    type: "snapshot" | "sheet" | "timeline" | "render",
    composition: string | undefined,
  ): Promise<{ tab: Tab; maySwitch: boolean } | Out> {
    const users = tabs.users();
    if (type === "render") {
      const user = tabs.pick(users);
      if (user) return { tab: user, maySwitch: false };
    } else if (composition) {
      const showing = tabs.pick(users.filter((t) => t.composition === composition));
      if (showing) return { tab: showing, maySwitch: false };
    } else {
      const user = tabs.pick(users);
      if (user) return { tab: user, maySwitch: false };
    }
    try {
      return { tab: await ownedTab(req), maySwitch: true };
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      return {
        status: 503,
        body: fail(
          "no-browser",
          `${why} No studio tab can answer this without changing what the user sees. Ask the user to open ${openUrl(req)}, or set SMOOVE_BROWSER to the path of a Chrome, Chromium or Edge binary.`,
        ),
      };
    }
  }

  // ---------------------------------------------------------------- replies

  async function reply(req: IncomingMessage, res: ServerResponse, query: URLSearchParams) {
    const id = query.get("req") ?? "";
    const p = pending.get(id);
    if (!p) {
      // Timed out already, or a stale tab answering after a restart.
      await drain(req);
      return send(res, 404, fail("bad-request", `No pending request with id "${id}".`));
    }
    const path = query.get("path");
    if (path) p.tab.path = path;
    const type = String(req.headers["content-type"] ?? "");

    if (type.startsWith("image/png")) {
      const bytes = await readBody(req, PNG_LIMIT);
      if (!pending.delete(id)) return send(res, 404, fail("bad-request", "Request expired."));
      clearTimeout(p.timer);
      const warnings = parseWarnings(query.get("warnings"));
      const data =
        query.get("kind") === "sheet" ? writeSheet(query, bytes) : writeSnapshot(query, bytes);
      p.settle(200, { ok: true, data, ...(warnings.length > 0 ? { warnings } : {}) });
      return send(res, 200, { ok: true, data: null });
    }

    const raw = await readBody(req, JSON_LIMIT);
    let body: AgentResponse<unknown>;
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch {
      body = {
        ok: false,
        error: { code: "tab-error", message: "The tab sent an unreadable reply." },
      };
    }
    if (!pending.delete(id)) return send(res, 404, fail("bad-request", "Request expired."));
    clearTimeout(p.timer);
    if (body.ok && p.type === "status") {
      const data: StatusData = {
        server: serverStatus(req),
        studio: body.data as StudioStatus,
        openUrl: openUrl(req),
      };
      p.settle(200, { ok: true, data });
    } else {
      p.settle(body.ok ? 200 : statusFor(body.error.code), body);
    }
    return send(res, 200, { ok: true, data: null });
  }

  function writeSnapshot(query: URLSearchParams, bytes: Buffer): SnapshotData {
    const composition = query.get("composition") ?? "composition";
    const frame = Number(query.get("frame") ?? 0);
    const width = Number(query.get("width") ?? 0);
    const height = Number(query.get("height") ?? 0);
    const dir = join(root, SNAPS_DIR);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, snapshotFileName(composition, frame, width));
    writeFileSync(path, bytes);
    return { path, composition, frame, width, height };
  }

  function writeSheet(query: URLSearchParams, bytes: Buffer): SheetData {
    const meta = JSON.parse(query.get("meta") ?? "{}") as Omit<SheetData, "path">;
    const dir = join(root, SHEETS_DIR);
    mkdirSync(dir, { recursive: true });
    const path = join(
      dir,
      sheetFileName(meta.composition, meta.mode, meta.tiles.length, meta.tileWidth),
    );
    writeFileSync(path, bytes);
    return { path, ...meta };
  }

  // ---------------------------------------------------------------- renders

  function unfinished(job: RenderData): boolean {
    return job.status === "queued" || job.status === "rendering" || job.status === "saving";
  }

  function renderData(job: RenderRecord): RenderData {
    const { tab: _tab, ...data } = job;
    return data;
  }

  async function startRender(req: IncomingMessage, params: RenderParams): Promise<Out> {
    const picked = await target(req, "render", params.composition);
    if ("status" in picked) return picked;
    const { tab } = picked;
    const composition = params.composition ?? tab.composition ?? undefined;
    const format: RenderFormat = params.format ?? "mp4";
    const out = await forward(tab, "render", {
      ...params,
      format,
      ...(composition ? { composition } : {}),
    } as TabRequest["params"]);
    if (!out.body.ok) return out;
    const queued = out.body.data as RenderQueued;
    const job: RenderRecord = {
      jobId: queued.jobId,
      composition: queued.composition,
      format: queued.format,
      status: "queued",
      progress: 0,
      out: params.out ?? join(root, "out", `${safeName(queued.composition)}.${queued.format}`),
      error: null,
      tab,
    };
    renders.set(job.jobId, job);
    return { status: 202, body: { ok: true, data: renderData(job), drawnBy: drawnBy(tab) } };
  }

  async function jobUpdate(req: IncomingMessage, update: TabJobUpdate): Promise<boolean> {
    const job = renders.get(update.jobId);
    const tab = tabs.get(update.tabId);
    if (!job || !tab || job.tab !== tab || !unfinished(job)) return false;
    if (job.status === "saving") return true;
    if (update.status === "done") {
      if (!update.result) {
        job.status = "error";
        job.error = "The render finished, but the studio gave no download URL for the file.";
        return true;
      }
      job.status = "saving";
      job.progress = 1;
      void save(req, job, update.result);
      return true;
    }
    job.status = update.status;
    job.progress = Math.max(0, Math.min(1, Number(update.progress) || 0));
    if (update.status === "error") job.error = update.error ?? "The render failed.";
    return true;
  }

  /** Fetch the finished file from the host's download URL and write it to `job.out`. */
  async function save(req: IncomingMessage, job: RenderRecord, result: string): Promise<void> {
    try {
      const base = baseUrl(req);
      if (!base) throw new Error("The dev server's URL isn't known.");
      const res = await fetch(new URL(result, base));
      if (!res.ok || !res.body) throw new Error(`Downloading the render failed (${res.status}).`);
      mkdirSync(join(job.out, ".."), { recursive: true });
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(job.out));
      job.status = "done";
    } catch (err) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : String(err);
    }
  }

  // ---------------------------------------------------------------- routing

  async function route(req: IncomingMessage, res: ServerResponse, sub: string, q: URLSearchParams) {
    const method = req.method ?? "GET";

    if (sub.startsWith("tab/")) {
      const why = tabOriginProblem(req);
      if (why) {
        await drain(req);
        return send(res, 403, fail("forbidden", why));
      }
      if (sub === "tab/hello" && method === "GET") {
        const hello: BridgeHello = { bridge: "smoove-agent", version: 1 };
        return send(res, 200, hello);
      }
      if (sub === "tab/connect" && method === "GET") return connectTab(req, res, q);
      if (sub === "tab/reply" && method === "POST") return reply(req, res, q);
      if (sub === "tab/presence" && method === "POST") {
        const body = await readJson<TabPresence>(req);
        const ok =
          body != null &&
          typeof body.tabId === "string" &&
          tabs.presence(body.tabId, {
            visible: body.visible !== false,
            focused: body.focused === true,
            path: typeof body.path === "string" ? body.path : undefined,
            composition:
              body.composition === null || typeof body.composition === "string"
                ? body.composition || null
                : undefined,
          });
        return send(
          res,
          ok ? 200 : 404,
          ok ? { ok: true, data: null } : fail("bad-request", "Unknown tab."),
        );
      }
      if (sub === "tab/mark-image" && method === "POST") return markImage(req, res, q);
      if (sub === "tab/mark" && method === "POST") return postMark(req, res);
      if (sub === "tab/mark-clear" && method === "POST") return clearMark(req, res);
      if (sub === "tab/job" && method === "POST") {
        const body = await readJson<TabJobUpdate>(req);
        const ok = body != null && (await jobUpdate(req, body));
        return send(
          res,
          ok ? 200 : 404,
          ok ? { ok: true, data: null } : fail("bad-request", "Unknown render job."),
        );
      }
      await drain(req);
      return send(res, 404, fail("bad-request", `No tab endpoint ${method} ${sub}.`));
    }

    if (!hasToken(req)) {
      await drain(req);
      return send(
        res,
        401,
        fail(
          "unauthorized",
          'Missing or wrong token. Send "Authorization: Bearer <token>", with the token from .smoove/agent.json in the project. It changes every time the dev server starts.',
        ),
      );
    }

    if (sub === "status" && method === "GET") {
      await settleAfterEdit();
      const empty = (): Out => ({
        status: 200,
        body: {
          ok: true,
          data: { server: serverStatus(req), studio: null, openUrl: openUrl(req) },
        },
      });
      const out = await dispatch("status", async () => {
        const user = tabs.pick(tabs.users());
        return user ? { tab: user, params: {} } : empty();
      });
      return sendOut(res, out);
    }

    if (sub === "seek" && method === "POST") {
      const params = parseSeek(await readJson<Record<string, unknown>>(req));
      if (typeof params === "string") return send(res, 400, fail("bad-request", params));
      await settleAfterEdit();
      const out = await dispatch("seek", async () => {
        const user = tabs.pick(tabs.users());
        return user
          ? { tab: user, params }
          : noTab(req, "Seek moves the user's view, and no user has a studio tab open.");
      });
      return sendOut(res, out);
    }

    if ((sub === "snapshot" || sub === "sheet" || sub === "timeline") && method === "POST") {
      const body = await readJson<Record<string, unknown>>(req);
      const params =
        sub === "snapshot"
          ? parseSnapshot(body)
          : sub === "sheet"
            ? parseSheet(body)
            : parseTimeline(body);
      if (typeof params === "string") return send(res, 400, fail("bad-request", params));
      await settleAfterEdit();
      const out = await dispatch(sub, async () => {
        const picked = await target(req, sub, params.composition);
        if ("status" in picked) return picked;
        return { tab: picked.tab, params: { ...params, maySwitch: picked.maySwitch } };
      });
      return sendOut(res, out);
    }

    if (sub === "render" && method === "POST") {
      const params = parseRender(await readJson<Record<string, unknown>>(req), root);
      if (typeof params === "string") return send(res, 400, fail("bad-request", params));
      await settleAfterEdit();
      return sendOut(res, await startRender(req, params));
    }

    if (sub === "context" && method === "POST") {
      await drain(req);
      const mark = marks.take();
      if (mark) broadcastMark();
      const data: ContextData = { mark };
      return send(res, 200, { ok: true, data });
    }

    if (sub.startsWith("render/") && method === "GET") {
      await drain(req);
      const job = renders.get(decodeURIComponent(sub.slice("render/".length)));
      if (!job) return send(res, 404, fail("bad-request", "No render job with that id."));
      return send(res, 200, { ok: true, data: renderData(job), drawnBy: drawnBy(job.tab) });
    }

    await drain(req);
    return send(
      res,
      404,
      fail(
        "bad-request",
        `No endpoint ${method} ${AGENT_PREFIX}${sub}. The endpoints are GET status, POST seek, POST snapshot, POST sheet, POST timeline, POST render, GET render/<job id> and POST context.`,
      ),
    );
  }

  function hasToken(req: IncomingMessage): boolean {
    const header = req.headers.authorization ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match?.[1]) return false;
    const given = Buffer.from(match[1].trim());
    const want = Buffer.from(token);
    return given.length === want.length && timingSafeEqual(given, want);
  }

  return {
    token,
    handle(req, res, next) {
      const raw = req.url ?? "/";
      if (!raw.startsWith(AGENT_PREFIX)) {
        next?.();
        return;
      }
      if (!isLoopbackAddress(req.socket?.remoteAddress)) {
        send(res, 403, fail("forbidden", "The smoove agent bridge only answers this machine."));
        return;
      }
      const u = new URL(raw, "http://localhost");
      const sub = u.pathname.slice(AGENT_PREFIX.length);
      route(req, res, sub, u.searchParams).catch((err: unknown) => {
        if (res.headersSent) return;
        const message = err instanceof BodyError ? err.message : String(err);
        send(res, err instanceof BodyError ? 400 : 500, fail("bad-request", message));
      });
    },
    listening(nextUrl) {
      url = nextUrl.endsWith("/") ? nextUrl : `${nextUrl}/`;
      const info: DiscoveryInfo = { url, token, pid: process.pid, startedAt };
      return writeDiscovery(root, info);
    },
    fileChanged() {
      lastChangeAt = now();
    },
    close() {
      if (closed) return;
      closed = true;
      clearInterval(ping);
      for (const [id, p] of pending) {
        pending.delete(id);
        clearTimeout(p.timer);
        p.settle(503, fail("tab-error", "The dev server is shutting down."));
      }
      for (const tab of tabs.all()) {
        tabs.remove(tab.id);
        tab.stream.end();
      }
      browser?.close();
      browser = null;
      process.off("exit", onExit);
      removeDiscovery(root, token);
    },
    tabs: () => tabs.all().map(summarize),
  };
}

// ---------------------------------------------------------------- helpers

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "composition";
}

/** `hello-smoove`, 120, 640 → `hello-smoove-f120-w640.png`. */
export function snapshotFileName(composition: string, frame: number, width: number): string {
  return `${safeName(composition)}-f${frame}-w${width}.png`;
}

/** `promo`, 120 → `promo-f120.png`. */
export function markFileName(composition: string, frame: number): string {
  return `${safeName(composition)}-f${frame}.png`;
}

/** Enough shape to hold and print a mark; the tab built it. */
function validMark(m: unknown): m is MarkInput {
  const mark = m as MarkInput | null | undefined;
  return (
    mark != null &&
    typeof mark.id === "string" &&
    mark.id !== "" &&
    typeof mark.composition === "string" &&
    Number.isInteger(mark.frame) &&
    mark.rect != null &&
    Array.isArray(mark.nodes)
  );
}

/** `promo`, `beats`, 5 tiles, 320 → `promo-beats-w320.png`; even sheets add the count. */
export function sheetFileName(
  composition: string,
  mode: "beats" | "even",
  tiles: number,
  tileWidth: number,
): string {
  const how = mode === "beats" ? "beats" : `even${tiles}`;
  return `${safeName(composition)}-${how}-w${tileWidth}.png`;
}

export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  if (address === "::1" || address === "0:0:0:0:0:0:0:1") return true;
  const v4 = address.startsWith("::ffff:") ? address.slice(7) : address;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v4);
}

/**
 * Why a tab request is refused, or null if it's fine. A request with an
 * `Origin` header must come from the dev server's own origin, and the browser's
 * `Sec-Fetch-Site` (when sent) must not say it's cross-site.
 */
export function tabOriginProblem(req: IncomingMessage): string | null {
  const origin = req.headers.origin;
  if (origin != null && (!req.headers.host || originHost(origin) !== req.headers.host)) {
    return `Tab requests must come from the studio's own origin, not ${origin}.`;
  }
  const site = req.headers["sec-fetch-site"];
  if (site === "cross-site" || site === "same-site") {
    return "Tab requests must come from the studio's own origin.";
  }
  return null;
}

/** `http://localhost:5190` → `localhost:5190`; null for `"null"` or garbage. */
function originHost(origin: string): string | null {
  try {
    return new URL(origin).host || null;
  } catch {
    return null;
  }
}

function parseWarnings(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((w): w is string => typeof w === "string") : [];
  } catch {
    return [];
  }
}

function parseComposition(b: Record<string, unknown>): string | undefined | false {
  if (b.composition === undefined) return undefined;
  if (typeof b.composition !== "string" || b.composition === "") return false;
  return b.composition;
}

function parseAtField(b: Record<string, unknown>): string | undefined | false {
  if (b.at === undefined) return undefined;
  if (typeof b.at !== "string" || b.at === "") return false;
  return b.at;
}

function parseSeek(body: Record<string, unknown> | null): SeekParams | string {
  if (!body) return 'Send a JSON body like {"frame": 90} or {"at": "hook"}.';
  const at = parseAtField(body);
  if (at === false) return '"at" must be a beat name, like "hook" or "hook.start".';
  const frame = body.frame ?? (at ? 0 : undefined);
  if (!isFrame(frame)) return '"frame" must be a whole number, 0 or more.';
  const composition = parseComposition(body);
  if (composition === false) return '"composition" must be a composition id.';
  return {
    frame,
    ...(at ? { at } : {}),
    ...(composition ? { composition } : {}),
  };
}

function parseSnapshot(body: Record<string, unknown> | null): SnapshotParams | string {
  const b = body ?? {};
  const out: SnapshotParams = {};
  if (b.frame !== undefined) {
    if (!isFrame(b.frame)) return '"frame" must be a whole number, 0 or more.';
    out.frame = b.frame;
  }
  const at = parseAtField(b);
  if (at === false) return '"at" must be a beat name, like "hook" or "hook.start".';
  if (at) out.at = at;
  if (b.width !== undefined) {
    const w = b.width;
    if (typeof w !== "number" || !Number.isInteger(w) || w < 1 || w > MAX_SNAPSHOT_WIDTH) {
      return `"width" must be a whole number of pixels from 1 to ${MAX_SNAPSHOT_WIDTH}.`;
    }
    out.width = w;
  } else {
    out.width = DEFAULT_SNAPSHOT_WIDTH;
  }
  const composition = parseComposition(b);
  if (composition === false) return '"composition" must be a composition id.';
  if (composition) out.composition = composition;
  return out;
}

function parseSheet(body: Record<string, unknown> | null): SheetParams | string {
  const b = body ?? {};
  const out: SheetParams = {};
  const composition = parseComposition(b);
  if (composition === false) return '"composition" must be a composition id.';
  if (composition) out.composition = composition;
  if (b.frames !== undefined) {
    const n = b.frames;
    if (
      typeof n !== "number" ||
      !Number.isInteger(n) ||
      n < MIN_SHEET_FRAMES ||
      n > MAX_SHEET_FRAMES
    ) {
      return `"frames" must be a whole number from ${MIN_SHEET_FRAMES} to ${MAX_SHEET_FRAMES}.`;
    }
    out.frames = n;
  }
  if (b.width !== undefined) {
    const w = b.width;
    if (typeof w !== "number" || !Number.isInteger(w) || w < 32 || w > MAX_TILE_WIDTH) {
      return `"width" must be a whole number of pixels from 32 to ${MAX_TILE_WIDTH}.`;
    }
    out.width = w;
  } else {
    out.width = DEFAULT_TILE_WIDTH;
  }
  return out;
}

function parseTimeline(body: Record<string, unknown> | null): TimelineParams | string {
  const composition = parseComposition(body ?? {});
  if (composition === false) return '"composition" must be a composition id.';
  return composition ? { composition } : {};
}

function parseRender(body: Record<string, unknown> | null, root: string): RenderParams | string {
  const b = body ?? {};
  const out: RenderParams = {};
  const composition = parseComposition(b);
  if (composition === false) return '"composition" must be a composition id.';
  if (composition) out.composition = composition;
  if (b.format !== undefined) {
    if (b.format !== "mp4" && b.format !== "webm") return '"format" must be "mp4" or "webm".';
    out.format = b.format;
  }
  if ((b.from === undefined) !== (b.to === undefined)) {
    return 'Give both "from" and "to" for a range, or neither.';
  }
  if (b.from !== undefined) {
    if (!isFrame(b.from) || !isFrame(b.to) || b.to < b.from) {
      return '"from" and "to" must be whole frames, with "to" at or after "from".';
    }
    out.from = b.from;
    out.to = b.to;
  }
  if (b.out !== undefined) {
    if (typeof b.out !== "string" || b.out === "") return '"out" must be a file path.';
    const abs = isAbsolute(b.out) ? b.out : resolvePath(root, b.out);
    const rel = relative(root, abs);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      return '"out" must be inside the project folder.';
    }
    out.out = abs;
  }
  return out;
}

function isFrame(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function statusFor(code: ErrorCode): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "bad-request":
    case "frame-out-of-range":
      return 400;
    case "unknown-composition":
    case "unknown-beat":
      return 404;
    case "no-tab":
    case "not-active":
      return 409;
    case "composition-error":
      return 422;
    case "no-browser":
      return 503;
    case "tab-timeout":
      return 504;
    default:
      return 500;
  }
}

function fail(code: ErrorCode, message: string): { ok: false; error: AgentErrorBody } {
  return { ok: false, error: { code, message } };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

function sendOut(res: ServerResponse, out: Out): void {
  send(res, out.status, out.body);
}

class BodyError extends Error {}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new BodyError(`The request body is larger than ${limit} bytes.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson<T>(req: IncomingMessage): Promise<T | null> {
  const raw = (await readBody(req, JSON_LIMIT)).toString("utf8").trim();
  if (raw === "") return null;
  try {
    const value = JSON.parse(raw);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new BodyError("The request body must be a JSON object.");
    }
    return value as T;
  } catch (err) {
    if (err instanceof BodyError) throw err;
    throw new BodyError("The request body isn't valid JSON.");
  }
}

function drain(req: IncomingMessage): Promise<void> {
  return new Promise((resolve) => {
    if (req.readableEnded) return resolve();
    req.resume();
    req.on("end", () => resolve());
    req.on("error", () => resolve());
    req.on("close", () => resolve());
  });
}
