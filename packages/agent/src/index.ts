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

/** Where contact sheets are written, relative to the Vite root. */
export const SHEETS_DIR = ".smoove/sheets";

/** Snapshot width when the request doesn't name one. */
export const DEFAULT_SNAPSHOT_WIDTH = 640;

/** Contact-sheet tile width when the request doesn't name one. */
export const DEFAULT_TILE_WIDTH = 320;

/** Tiles per row on a contact sheet. */
export const SHEET_COLUMNS = 4;

/** Evenly spaced frame counts a sheet accepts, and the fallback count. */
export const MIN_SHEET_FRAMES = 2;
export const MAX_SHEET_FRAMES = 24;
export const FALLBACK_SHEET_FRAMES = 8;

/** How long the server waits for its own headless tab to connect. */
export const HEADLESS_CONNECT_MS = 30_000;

/** Query parameter that marks the tab the server launched in its headless browser. */
export const AGENT_TAB_PARAM = "smoove-agent-tab";

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
  | "tab-error"
  | "no-browser"
  | "unknown-beat"
  | "render-off"
  | "render-error"
  | "no-server"
  | "checks-error";

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

/**
 * Every answer has this shape. `warnings` are things the agent should know
 * about a successful answer, such as video the headless tab couldn't draw.
 */
export type AgentResponse<T> =
  | { ok: true; data: T; drawnBy?: DrawnBy; warnings?: string[] }
  | { ok: false; error: AgentErrorBody; drawnBy?: DrawnBy; warnings?: string[] };

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
  /** True for the tab the server launched in its own headless browser. */
  owned: boolean;
  /** The composition the tab shows, or null on a page with none open. */
  composition: string | null;
  /** ISO timestamp of the last focus gain, or null if it never had focus. */
  lastFocusAt: string | null;
  connectedAt: string;
}

export interface ServerStatus {
  url: string;
  pid: number;
  startedAt: string;
  tabs: TabSummary[];
  /** The mark waiting for `smoove context`, or null. */
  mark: { composition: string; frame: number } | null;
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
  /** Zero-based frame. Ignored when `at` is given. */
  frame: number;
  /** A point in time by beat name (see {@link parseAt}). Wins over `frame`. */
  at?: string;
  /** Switch to this composition first, if it isn't the open one. */
  composition?: string;
}

export interface SeekData {
  composition: string;
  frame: number;
}

/* ============================================================ snapshot */

/**
 * Set by the server, never by an agent: the tab may switch to the requested
 * composition (or open the first one) because nobody is watching it. Only the
 * server's own headless tab gets this.
 */
export interface MaySwitch {
  maySwitch?: boolean;
}

export interface SnapshotParams extends MaySwitch {
  /** Zero-based frame. Defaults to the current frame. */
  frame?: number;
  /** A point in time by beat name (see {@link parseAt}). Wins over `frame`. */
  at?: string;
  /** Output width in pixels. Defaults to 640, capped at the composition's width. */
  width?: number;
  /** The composition to draw. Defaults to the open one. */
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
  warnings?: string[];
}

/* ============================================================ beats */

/** One beat: a planned marker, or a top-level sequence when there's no plan. */
export interface Beat {
  name: string;
  /** First frame. */
  start: number;
  /** The frame the beat is fully revealed (after its incoming overlap). */
  settled: number;
  /** The first frame after the beat (exclusive). */
  end: number;
  /** The frame a contact sheet shows for this beat (see {@link sheetFrame}). */
  sheet: number;
}

/**
 * The frame a contact sheet shows for a beat: one before the earlier of its
 * end and the next beat's start, so entrances are done and exits haven't
 * begun. Never before the beat's own start, never past the composition.
 */
export function sheetFrame(
  beat: { start: number; end: number },
  nextStart: number | null,
  durationInFrames: number,
): number {
  const stop =
    nextStart != null && nextStart > beat.start ? Math.min(beat.end, nextStart) : beat.end;
  const last = Math.min(stop, durationInFrames) - 1;
  return Math.max(beat.start, Math.min(last, durationInFrames - 1), 0);
}

/** Fill in each beat's sheet frame from the beat after it (in start order). */
export function withSheetFrames(
  beats: Array<Omit<Beat, "sheet">>,
  durationInFrames: number,
): Beat[] {
  const ordered = [...beats].sort((a, b) => a.start - b.start);
  return beats.map((b) => {
    const i = ordered.indexOf(b);
    const next = ordered.slice(i + 1).find((n) => n.start > b.start);
    return { ...b, sheet: sheetFrame(b, next?.start ?? null, durationInFrames) };
  });
}

export type BeatPoint = "start" | "settled" | "last" | "end" | "sheet";

/**
 * Parse `--at` text: `hook` (the sheet frame), or `hook.start`, `hook.settled`,
 * `hook.last` (the beat's last frame) or `hook.end` (the first frame after it).
 * The point is split off the last dot, so beat names may contain dots.
 */
export function parseAt(text: string): { beat: string; point: BeatPoint } {
  const dot = text.lastIndexOf(".");
  if (dot > 0) {
    const point = text.slice(dot + 1);
    if (point === "start" || point === "settled" || point === "last" || point === "end") {
      return { beat: text.slice(0, dot), point };
    }
  }
  return { beat: text, point: "sheet" };
}

/** The frame an `--at` text names among `beats`, or an `unknown-beat` error. */
export function resolveAt(text: string, beats: Beat[]): number {
  const { beat, point } = parseAt(text);
  const found = beats.find((b) => b.name === beat);
  if (!found) {
    const names = beats.map((b) => b.name);
    throw new AgentError(
      "unknown-beat",
      names.length > 0
        ? `There's no beat named "${beat}". The beats are: ${names.join(", ")}.`
        : `There's no beat named "${beat}". This composition has no plan and no named sequences.`,
    );
  }
  switch (point) {
    case "start":
      return found.start;
    case "settled":
      return found.settled;
    case "last":
      return Math.max(found.start, found.end - 1);
    case "end":
      return found.end;
    default:
      return found.sheet;
  }
}

/* ============================================================ sheet */

export interface SheetParams extends MaySwitch {
  composition?: string;
  /** Evenly spaced frames, 2 to 24. Omit for one tile per beat. */
  frames?: number;
  /** Tile width in pixels. Default 320. */
  width?: number;
}

export interface SheetTile {
  frame: number;
  /** The beat this tile shows, when the sheet is by beat. */
  beat: string | null;
}

export interface SheetData {
  path: string;
  composition: string;
  /** `beats` (one tile per beat or sequence) or `even` (evenly spaced). */
  mode: "beats" | "even";
  tileWidth: number;
  tileHeight: number;
  /** The whole sheet's size in pixels. */
  width: number;
  height: number;
  tiles: SheetTile[];
}

/** What a tab's sheet handler hands back; the client posts the bytes. */
export interface SheetResult extends Omit<SheetData, "path"> {
  png: Blob;
  warnings?: string[];
}

/* ============================================================ timeline */

export interface TimelineParams extends MaySwitch {
  composition?: string;
}

export interface TimelineNode {
  /** The node's name, or its id, or a generated label. */
  name: string;
  /** `sequence`, `clip`, or a kind from a name prefix (`audio:`, `video:`, ...). */
  kind: string;
  /** Absolute composition frames; `end` is exclusive. */
  start: number;
  end: number;
  children: TimelineNode[];
}

export interface TimelineData {
  composition: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** Where the beats came from: the composition's plan, or its sequences. */
  beatsFrom: "plan" | "sequences";
  beats: Beat[];
  sequences: TimelineNode[];
}

/* ============================================================ render */

export type RenderFormat = "mp4" | "webm";

export interface RenderParams {
  composition?: string;
  format?: RenderFormat;
  /** Inclusive frame range. Both or neither. */
  from?: number;
  to?: number;
  /** Absolute path inside the project. Default `out/<composition>.<format>`. */
  out?: string;
}

/** The tab's answer to a render request: the job is queued in its studio. */
export interface RenderQueued {
  jobId: string;
  composition: string;
  format: RenderFormat;
}

export type RenderState = "queued" | "rendering" | "saving" | "done" | "error" | "canceled";

export interface RenderData {
  jobId: string;
  composition: string;
  format: RenderFormat;
  status: RenderState;
  /** 0 to 1. */
  progress: number;
  /** Where the file goes (or went). */
  out: string;
  error: string | null;
}

/** `POST tab/job` body: a tab reports a render job's progress. */
export interface TabJobUpdate {
  tabId: string;
  jobId: string;
  status: "queued" | "rendering" | "done" | "error" | "canceled";
  progress: number;
  /** The host's download URL, once done. */
  result?: string;
  error?: string;
}

/* ============================================================ marks */

/** Where mark images are written, relative to the Vite root. */
export const MARKS_DIR = ".smoove/marks";

/** A node counts as marked when more than this share of its box is inside the rectangle. */
export const MARK_MIN_COVER = 0.6;

/** When no node passes {@link MARK_MIN_COVER}, a mark lists this many closest ones instead. */
export const MARK_CLOSEST = 3;

/** A marked Text node's text is cut to this many characters. */
export const MARK_TEXT_MAX = 80;

/** A rectangle in composition pixels. */
export interface MarkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a node was created. Lines and columns are 1-based. */
export interface SourceLocation {
  /** Relative to the project root, with forward slashes. */
  file: string;
  line: number;
  column: number;
  /** True when the node has no tag of its own and this is its nearest tagged ancestor's. */
  inherited: boolean;
}

/** One node the user's rectangle covers. */
export interface MarkNode {
  name: string | null;
  id: string | null;
  /** The class the author wrote, e.g. `Text`. */
  type: string;
  /** Axis-aligned bounds in composition pixels. */
  box: MarkRect;
  /** The share of `box` inside the rectangle, from 0 to 1. */
  cover: number;
  /** Text nodes only, cut to {@link MARK_TEXT_MAX} characters. */
  text?: string;
  /** Named ancestors, outermost first. */
  ancestors: string[];
  source: SourceLocation | null;
}

/** A mark as a tab sends it. The tab picks the id. */
export interface MarkInput {
  id: string;
  composition: string;
  /** Zero-based. */
  frame: number;
  /** The beat that contains the frame, or null. */
  beat: string | null;
  rect: MarkRect;
  /** Smallest first (see {@link selectMarked}), or the closest ones when `closest`. */
  nodes: MarkNode[];
  /**
   * True when no node passed the threshold, so `nodes` holds the best-covered
   * ones instead (see {@link closestMarked}).
   */
  closest?: boolean;
}

/** A mark as the server holds it and `smoove context` reads it. */
export interface Mark extends MarkInput {
  /** ISO timestamp. */
  drawnAt: string;
  drawnBy: DrawnBy;
  /** Absolute path of the frame image with the rectangle drawn on it, or null. */
  image: string | null;
}

export interface ContextData {
  /** Null when there's no mark. */
  mark: Mark | null;
}

/** `POST tab/mark` body. */
export interface TabMarkPost {
  tabId: string;
  mark: MarkInput;
}

/** `POST tab/mark-clear` body. */
export interface TabMarkClear {
  tabId: string;
  id: string;
}

/** The `mark` event on a tab stream: the server's current mark id, or null. */
export interface TabMarkEvent {
  id: string | null;
}

/** The share of `box`'s own area inside `rect`, from 0 to 1. A box with no area is 0. */
export function coverage(box: MarkRect, rect: MarkRect): number {
  const area = box.width * box.height;
  if (!(area > 0)) return 0;
  const w = Math.min(box.x + box.width, rect.x + rect.width) - Math.max(box.x, rect.x);
  const h = Math.min(box.y + box.height, rect.y + rect.height) - Math.max(box.y, rect.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / area;
}

/**
 * The candidates more than `min` inside `rect`, each with its coverage,
 * smallest area first so the most specific thing the user framed leads.
 * Equal areas keep their input order.
 */
export function selectMarked<T extends { box: MarkRect }>(
  candidates: T[],
  rect: MarkRect,
  min = MARK_MIN_COVER,
): Array<T & { cover: number }> {
  return candidates
    .map((c) => ({ ...c, cover: coverage(c.box, rect) }))
    .filter((c) => c.cover > min)
    .sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height);
}

/**
 * The fallback when nothing passes: the `count` candidates the rectangle
 * covers most, most covered first. Untouched candidates never count.
 */
export function closestMarked<T extends { box: MarkRect }>(
  candidates: T[],
  rect: MarkRect,
  count = MARK_CLOSEST,
): Array<T & { cover: number }> {
  return candidates
    .map((c) => ({ ...c, cover: coverage(c.box, rect) }))
    .filter((c) => c.cover > 0)
    .sort((a, b) => b.cover - a.cover)
    .slice(0, count);
}

/* ============================================================ checks */

/** Where finding images are written, relative to the Vite root. */
export const CHECKS_DIR = ".smoove/checks";

/** How long the server waits for a check: a sweep seeks through every sampled frame. */
export const CHECK_TIMEOUT_MS = 120_000;

export interface CheckParams extends MaySwitch {
  composition?: string;
  /** Run only these groups: purity, layout, intent, motion, style. */
  groups?: string[];
  /** Write an image for each error and held warning. */
  images?: boolean;
}

/**
 * The wire shape of a finding. `@smoove/core/testing`'s `Finding` must fit
 * it; the studio type-checks that, since this package depends on no smoove
 * package.
 */
export interface CheckFinding {
  code: string;
  severity: "error" | "warning";
  held: boolean;
  message: string;
  composition: string;
  node: Omit<MarkNode, "cover"> | null;
  /** Both ends included. */
  frames: Array<{ from: number; to: number }>;
  beats: string[];
  source: SourceLocation | null;
  details?: Record<string, unknown>;
  /** Absolute path of the finding's image, with `images`. */
  image?: string;
}

export interface CheckData {
  composition: string;
  /** Every composition id in the studio's catalog, for `smoove check --all`. */
  catalog: string[];
  hasChecksFile: boolean;
  /** Whether the checks file declares a palette. Without one, `colorsInUse` is worth printing. */
  hasPalette: boolean;
  frames: number;
  beats: number;
  samples: number;
  findings: CheckFinding[];
  allowed: Array<CheckFinding & { reason: string }>;
  colorsInUse: string[];
}

/** What a tab's check handler hands back; the client posts the images, then the data. */
export interface CheckResult extends CheckData {
  images?: Array<{ finding: number; frame: number; png: Blob }>;
}

/* ============================================================ tab protocol */

export type TabRequest =
  | { id: string; type: "status"; params: Record<string, never> }
  | { id: string; type: "seek"; params: SeekParams }
  | { id: string; type: "snapshot"; params: SnapshotParams }
  | { id: string; type: "sheet"; params: SheetParams }
  | { id: string; type: "timeline"; params: TimelineParams }
  | { id: string; type: "render"; params: RenderParams & { composition: string } }
  | { id: string; type: "check"; params: CheckParams };

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
  /** The composition the tab shows, or null. */
  composition?: string | null;
}
