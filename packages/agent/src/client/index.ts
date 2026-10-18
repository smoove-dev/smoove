/**
 * @smoove/agent/client: connects a browser tab to the dev-server bridge and
 * answers its requests with the handlers it is given. Browser only.
 *
 * Nothing here waits on a timer or an animation frame: background tabs throttle
 * both. Each request runs as a direct promise chain from the incoming event,
 * one at a time, in arrival order.
 */
import {
  AGENT_PREFIX,
  AgentError,
  type AgentResponse,
  type BridgeHello,
  type SeekData,
  type SeekParams,
  type SnapshotParams,
  type SnapshotResult,
  type StudioStatus,
  type TabCancel,
  type TabHello,
  type TabPresence,
  type TabRequest,
} from "../index.js";

export interface HandlerContext {
  /** Aborted when the server gives up waiting (its timeout) or the tab disconnects. */
  signal: AbortSignal;
}

export interface TabHandlers {
  status(ctx: HandlerContext): StudioStatus | Promise<StudioStatus>;
  seek(params: SeekParams, ctx: HandlerContext): SeekData | Promise<SeekData>;
  snapshot(params: SnapshotParams, ctx: HandlerContext): Promise<SnapshotResult>;
}

export interface ConnectOptions {
  handlers: TabHandlers;
  /** Path prefix of the bridge. Default `/__smoove/agent/`. */
  base?: string;
}

export interface AgentTabConnection {
  /** The id the server gave this tab, once its stream has opened. */
  readonly tabId: string | null;
  close(): void;
}

/** True in a headless browser: the user agent says so, or webdriver is on. */
export function isHeadless(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.webdriver === true || /\bHeadless/i.test(navigator.userAgent);
}

/** Does this page's dev server have a bridge mounted? */
export async function hasBridge(base = AGENT_PREFIX): Promise<boolean> {
  try {
    const res = await fetch(`${base}tab/hello`, { cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as Partial<BridgeHello>;
    return body.bridge === "smoove-agent";
  } catch {
    return false;
  }
}

/**
 * Connect this tab to the bridge. Resolves to null when there is no bridge
 * (a production build, or the Vite plugin's `agent` option is off), and the
 * caller should stay quiet from then on.
 */
export async function connectAgentTab(opts: ConnectOptions): Promise<AgentTabConnection | null> {
  const base = opts.base ?? AGENT_PREFIX;
  if (!(await hasBridge(base))) return null;

  const { handlers } = opts;
  const controllers = new Map<string, AbortController>();
  let tabId: string | null = null;
  let chain: Promise<void> = Promise.resolve();
  let closed = false;

  const focused = (): boolean => typeof document !== "undefined" && document.hasFocus();
  const visible = (): boolean =>
    typeof document === "undefined" || document.visibilityState === "visible";
  const path = (): string => location.pathname + location.search;

  const qs = new URLSearchParams({
    path: path(),
    visible: visible() ? "1" : "0",
    focused: focused() ? "1" : "0",
    headless: isHeadless() ? "1" : "0",
  });
  const stream = new EventSource(`${base}tab/connect?${qs}`);

  stream.addEventListener("hello", (e) => {
    const hello = JSON.parse((e as MessageEvent<string>).data) as TabHello;
    // A reconnect gets a fresh id; anything queued for the old one is moot.
    if (tabId && tabId !== hello.tabId) abortAll();
    tabId = hello.tabId;
  });
  stream.addEventListener("request", (e) => {
    const req = JSON.parse((e as MessageEvent<string>).data) as TabRequest;
    const ctl = new AbortController();
    controllers.set(req.id, ctl);
    chain = chain.then(() => run(req, ctl.signal)).finally(() => controllers.delete(req.id));
  });
  stream.addEventListener("cancel", (e) => {
    const { id } = JSON.parse((e as MessageEvent<string>).data) as TabCancel;
    controllers.get(id)?.abort(new AgentError("tab-timeout", "The server stopped waiting."));
  });

  function abortAll(): void {
    for (const ctl of controllers.values()) ctl.abort();
    controllers.clear();
  }

  async function run(req: TabRequest, signal: AbortSignal): Promise<void> {
    if (signal.aborted || closed) return;
    const ctx: HandlerContext = { signal };
    try {
      switch (req.type) {
        case "status":
          return await postJson(req.id, { ok: true, data: await handlers.status(ctx) });
        case "seek":
          return await postJson(req.id, { ok: true, data: await handlers.seek(req.params, ctx) });
        case "snapshot": {
          const snap = await handlers.snapshot(req.params, ctx);
          if (signal.aborted) return;
          return await postPng(req.id, snap);
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      const error =
        err instanceof AgentError
          ? { code: err.code, message: err.message }
          : {
              code: "tab-error" as const,
              message: err instanceof Error ? err.message : String(err),
            };
      await postJson(req.id, { ok: false, error }).catch(() => {});
    }
  }

  function replyUrl(id: string, extra: Record<string, string> = {}): string {
    return `${base}tab/reply?${new URLSearchParams({ req: id, path: path(), ...extra })}`;
  }

  async function postJson(id: string, body: AgentResponse<unknown>): Promise<void> {
    await fetch(replyUrl(id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function postPng(id: string, snap: SnapshotResult): Promise<void> {
    await fetch(
      replyUrl(id, {
        composition: snap.composition,
        frame: String(snap.frame),
        width: String(snap.width),
        height: String(snap.height),
      }),
      { method: "POST", headers: { "Content-Type": "image/png" }, body: snap.png },
    );
  }

  function reportPresence(): void {
    if (!tabId || closed) return;
    const body: TabPresence = { tabId, visible: visible(), focused: focused(), path: path() };
    void fetch(`${base}tab/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  window.addEventListener("focus", reportPresence);
  window.addEventListener("blur", reportPresence);
  document.addEventListener("visibilitychange", reportPresence);

  return {
    get tabId() {
      return tabId;
    },
    close() {
      if (closed) return;
      closed = true;
      abortAll();
      stream.close();
      window.removeEventListener("focus", reportPresence);
      window.removeEventListener("blur", reportPresence);
      document.removeEventListener("visibilitychange", reportPresence);
    },
  };
}
