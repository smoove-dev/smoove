import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import {
  AGENT_PREFIX,
  type AgentErrorBody,
  type AgentResponse,
  type BridgeHello,
  DEFAULT_SNAPSHOT_WIDTH,
  type DiscoveryInfo,
  type ErrorCode,
  type SeekParams,
  SNAPS_DIR,
  type SnapshotData,
  type SnapshotParams,
  type StatusData,
  type StudioStatus,
  TAB_TIMEOUT_MS,
  type TabPresence,
  type TabRequest,
  type TabRequestType,
} from "../index.js";
import { removeDiscovery, writeDiscovery } from "./discovery.js";
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
  settle: (status: number, body: AgentResponse<unknown>) => void;
  timer: ReturnType<typeof setTimeout>;
}

const JSON_LIMIT = 1 << 20;
const PNG_LIMIT = 64 << 20;
const MAX_SNAPSHOT_WIDTH = 8192;

/**
 * The dev-server half of the bridge. Agent-facing endpoints (`status`, `seek`,
 * `snapshot`) need the per-run bearer token; tab-facing ones (`tab/*`) are
 * same-origin only. Everything refuses a remote address that isn't this machine.
 */
export function createAgentBridge(options: AgentBridgeOptions): AgentBridge {
  const root = options.root;
  const timeoutMs = options.timeoutMs ?? TAB_TIMEOUT_MS;
  const settleMs = options.settleMs ?? 300;
  const pingMs = options.pingMs ?? 15_000;
  const now = options.now ?? Date.now;
  const token = options.token ?? randomBytes(24).toString("base64url");
  const startedAt = new Date(now()).toISOString();
  const tabs = new TabList(now);
  const pending = new Map<string, Pending>();
  let url: string | null = null;
  let lastChangeAt = Number.NEGATIVE_INFINITY;
  let closed = false;

  const onExit = (): void => removeDiscovery(root, token);

  const ping = setInterval(() => {
    for (const tab of tabs.all()) tab.stream.write(": ping\n\n");
  }, pingMs);
  ping.unref?.();

  function openUrl(req?: IncomingMessage): string {
    if (url) return url;
    const host = req?.headers.host;
    return host ? `http://${host}/` : "the studio dev server URL";
  }

  function serverStatus(req?: IncomingMessage): StatusData["server"] {
    return {
      url: openUrl(req),
      pid: process.pid,
      startedAt,
      tabs: tabs.all().map(summarize),
    };
  }

  // ---------------------------------------------------------------- tabs

  function connectTab(req: IncomingMessage, res: ServerResponse, query: URLSearchParams): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const tab = tabs.add({
      id: randomUUID(),
      path: query.get("path") || "/",
      visible: query.get("visible") !== "0",
      focused: query.get("focused") === "1",
      headless: query.get("headless") === "1",
      stream: res,
    });
    sendEvent(tab, "hello", { tabId: tab.id });
    req.on("close", () => {
      if (!tabs.remove(tab.id)) return;
      for (const [id, p] of pending) {
        if (p.tab !== tab) continue;
        pending.delete(id);
        clearTimeout(p.timer);
        p.settle(502, {
          ok: false,
          error: {
            code: "tab-error",
            message: `The studio tab at ${tab.path} closed before it answered. Run the request again.`,
          },
        });
      }
    });
  }

  function sendEvent(tab: Tab, event: string, data: unknown): void {
    tab.stream.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  async function forward(
    req: IncomingMessage,
    type: TabRequestType,
    params: TabRequest["params"],
  ): Promise<{ status: number; body: AgentResponse<unknown> }> {
    // Right after an edit, give the hot update a moment to reach the tab.
    const wait = lastChangeAt + settleMs - now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const tab = tabs.pick();
    if (!tab) return noTab(req);

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
        settle: (status, body) => resolve({ status, body: { ...body, drawnBy: drawnBy(tab) } }),
      });
      sendEvent(tab, "request", { id, type, params } as TabRequest);
    });
  }

  function noTab(req: IncomingMessage): { status: number; body: AgentResponse<unknown> } {
    return {
      status: 409,
      body: {
        ok: false,
        error: {
          code: "no-tab",
          message: `No studio tab is connected. Open ${openUrl(req)} in a browser, then try again.`,
        },
      },
    };
  }

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
      const data = writeSnapshot(query, bytes);
      p.settle(200, { ok: true, data });
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
          });
        return send(
          res,
          ok ? 200 : 404,
          ok ? { ok: true, data: null } : fail("bad-request", "Unknown tab."),
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
      if (tabs.size === 0) {
        const data: StatusData = { server: serverStatus(req), studio: null, openUrl: openUrl(req) };
        return send(res, 200, { ok: true, data });
      }
      const out = await forward(req, "status", {});
      return send(res, out.status, out.body);
    }

    if (sub === "seek" && method === "POST") {
      const body = await readJson<Record<string, unknown>>(req);
      const params = parseSeek(body);
      if (typeof params === "string") return send(res, 400, fail("bad-request", params));
      if (tabs.size === 0) return sendOut(res, noTab(req));
      return sendOut(res, await forward(req, "seek", params));
    }

    if (sub === "snapshot" && method === "POST") {
      const body = await readJson<Record<string, unknown>>(req);
      const params = parseSnapshot(body);
      if (typeof params === "string") return send(res, 400, fail("bad-request", params));
      if (tabs.size === 0) return sendOut(res, noTab(req));
      return sendOut(res, await forward(req, "snapshot", params));
    }

    await drain(req);
    return send(
      res,
      404,
      fail(
        "bad-request",
        `No endpoint ${method} ${AGENT_PREFIX}${sub}. The endpoints are GET status, POST seek and POST snapshot.`,
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
      const file = writeDiscovery(root, info);
      process.off("exit", onExit);
      process.on("exit", onExit);
      return file;
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
      process.off("exit", onExit);
      removeDiscovery(root, token);
    },
    tabs: () => tabs.all().map(summarize),
  };
}

// ---------------------------------------------------------------- helpers

/** `hello-smoove`, 120, 640 → `hello-smoove-f120-w640.png`. */
export function snapshotFileName(composition: string, frame: number, width: number): string {
  const safe =
    composition.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "composition";
  return `${safe}-f${frame}-w${width}.png`;
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

function parseSeek(body: Record<string, unknown> | null): SeekParams | string {
  if (!body) return 'Send a JSON body like {"frame": 90}.';
  const frame = body.frame;
  if (!isFrame(frame)) return '"frame" must be a whole number, 0 or more.';
  const composition = body.composition;
  if (composition !== undefined && (typeof composition !== "string" || composition === "")) {
    return '"composition" must be a composition id.';
  }
  return composition === undefined ? { frame } : { frame, composition };
}

function parseSnapshot(body: Record<string, unknown> | null): SnapshotParams | string {
  const b = body ?? {};
  const out: SnapshotParams = {};
  if (b.frame !== undefined) {
    if (!isFrame(b.frame)) return '"frame" must be a whole number, 0 or more.';
    out.frame = b.frame;
  }
  if (b.width !== undefined) {
    const w = b.width;
    if (typeof w !== "number" || !Number.isInteger(w) || w < 1 || w > MAX_SNAPSHOT_WIDTH) {
      return `"width" must be a whole number of pixels from 1 to ${MAX_SNAPSHOT_WIDTH}.`;
    }
    out.width = w;
  } else {
    out.width = DEFAULT_SNAPSHOT_WIDTH;
  }
  if (b.composition !== undefined) {
    if (typeof b.composition !== "string" || b.composition === "") {
      return '"composition" must be a composition id.';
    }
    out.composition = b.composition;
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
      return 404;
    case "no-tab":
    case "not-active":
      return 409;
    case "composition-error":
      return 422;
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

function sendOut(res: ServerResponse, out: { status: number; body: unknown }): void {
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
