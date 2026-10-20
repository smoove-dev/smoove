/**
 * @smoove/agent: the message format shared by the dev-server bridge
 * (`@smoove/agent/server`), the studio tab (`@smoove/agent/client`) and the
 * command line tool that wraps the endpoints. No runtime dependencies, so it
 * imports cleanly in Node and in the browser.
 */

/** Every bridge endpoint lives under this path prefix. */
export const AGENT_PREFIX = "/__smoove/agent/";

/** The discovery file, relative to the Vite root. */
export const DISCOVERY_FILE = ".smoove/agent.json";

/** Where snapshot PNGs are written, relative to the Vite root. */
export const SNAPS_DIR = ".smoove/snaps";

/** How long the server waits for a tab to answer one request. */
export const TAB_TIMEOUT_MS = 15_000;

/** Snapshot width when the request doesn't name one. */
export const DEFAULT_SNAPSHOT_WIDTH = 640;

/* ============================================================ errors */

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "bad-request"
  | "no-tab"
  | "tab-timeout"
  | "unknown-composition"
  | "frame-out-of-range"
  | "not-active"
  | "composition-error"
  | "tab-error";

export interface AgentErrorBody {
  code: ErrorCode;
  /** Human-readable, written for the agent reading it. */
  message: string;
}

/**
 * Thrown by a tab handler to answer with a specific error code. Anything else a
 * handler throws becomes `tab-error` with the thrown message.
 */
export class AgentError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "AgentError";
    this.code = code;
  }
}

/* ============================================================ envelope */

/** Which tab produced an answer. */
export interface DrawnBy {
  tabId: string;
  /** The tab's URL path when it answered (e.g. `/c/hello-smoove`). */
  path: string;
  visible: boolean;
  /** From the user agent string or the webdriver flag. */
  headless: boolean;
}

export type AgentResponse<T> =
  | { ok: true; data: T; drawnBy?: DrawnBy }
  | { ok: false; error: AgentErrorBody; drawnBy?: DrawnBy };

/* ============================================================ discovery */

/** The contents of `.smoove/agent.json`. */
export interface DiscoveryInfo {
  /** The dev server's local URL, e.g. `http://localhost:5190/`. */
  url: string;
  token: string;
  pid: number;
  /** ISO timestamp. */
  startedAt: string;
}

/* ============================================================ status */

export interface TabSummary {
  tabId: string;
  path: string;
  visible: boolean;
  focused: boolean;
  headless: boolean;
  /** ISO timestamp of the last focus gain, or null if it never had focus. */
  lastFocusAt: string | null;
  connectedAt: string;
}

export interface ServerStatus {
  url: string;
  pid: number;
  startedAt: string;
  tabs: TabSummary[];
}

export interface CatalogEntry {
  id: string;
  title: string | null;
  group: string | null;
}

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface ActiveComposition {
  id: string;
  loadStatus: LoadStatus;
  /** `"buffering"` while fonts or media are still loading. */
  assets: "ready" | "buffering";
  /** The build error, when `loadStatus` is `"error"`. */
  error: string | null;
  /** The fields below are null until the composition is built. */
  width: number | null;
  height: number | null;
  fps: number | null;
  durationInFrames: number | null;
  /** Zero-based. */
  frame: number | null;
  playing: boolean;
}

/** What the studio tab reports. */
export interface StudioStatus {
  catalog: CatalogEntry[];
  active: ActiveComposition | null;
}

export interface StatusData {
  server: ServerStatus;
  /** Null when no tab is connected. */
  studio: StudioStatus | null;
  /** The studio URL to open when no tab is connected. */
  openUrl: string;
}

/* ============================================================ seek */

export interface SeekParams {
  /** Zero-based frame. */
  frame: number;
  /** Switch to this composition first, if it isn't the open one. */
  composition?: string;
}

export interface SeekData {
  composition: string;
  frame: number;
}

/* ============================================================ snapshot */

export interface SnapshotParams {
  /** Zero-based frame. Defaults to the current frame. */
  frame?: number;
  /** Output width in pixels. Defaults to 640, capped at the composition's width. */
  width?: number;
  /** Must be the open composition, if given. */
  composition?: string;
}

export interface SnapshotData {
  /** Absolute path of the PNG on disk. */
  path: string;
  composition: string;
  frame: number;
  width: number;
  height: number;
}

/** What a tab's snapshot handler hands back; the client posts the bytes. */
export interface SnapshotResult {
  png: Blob;
  composition: string;
  frame: number;
  width: number;
  height: number;
}

/* ============================================================ tab protocol */

export type TabRequest =
  | { id: string; type: "status"; params: Record<string, never> }
  | { id: string; type: "seek"; params: SeekParams }
  | { id: string; type: "snapshot"; params: SnapshotParams };

export type TabRequestType = TabRequest["type"];

/** The first event on a tab's stream. */
export interface TabHello {
  tabId: string;
}

/** Sent when the server gave up waiting, so the tab can drop the work. */
export interface TabCancel {
  id: string;
}

/** `GET tab/hello` answer: proves a bridge is mounted. */
export interface BridgeHello {
  bridge: "smoove-agent";
  version: 1;
}

/** `POST tab/presence` body. */
export interface TabPresence {
  tabId: string;
  visible: boolean;
  focused: boolean;
  path: string;
}
