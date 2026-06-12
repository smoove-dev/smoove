import type { Composition, ReadonlySignal } from "@konva-motion/core";
import type { IconName } from "./components/icon/paths.js";
import type { LayerKind } from "./lib/constants.js";
import type { KmSchema } from "./schema/types.js";

/** A signal you can both read and write. The store owns the writable side; an
    entry's `load` only sees the readable side. */
export interface WritableSignal<T> extends ReadonlySignal<T> {
  set(value: T): void;
}

export type PropsSignal<P = Record<string, unknown>> = WritableSignal<P>;

/* ============================================================ registry */

/** A timeline track derived from (or declared for) a composition. */
export type StudioLayer = {
  name: string;
  kind: LayerKind;
  /** Normalized [0,1] bounds across the composition duration. */
  start: number;
  end: number;
};

export interface RegistryEntry<P extends Record<string, unknown> = Record<string, unknown>> {
  /** REQUIRED — the stable key shared by catalog + route segment (`/:id`). */
  id: string;
  title?: string;
  group?: string;
  tags?: string[];
  description?: string;
  /** Drives the auto-generated props form. */
  propsSchema?: KmSchema;
  /** Overrides deep-merged over the schema defaults. */
  defaultProps?: P;
  /** Explicit layer override; otherwise layers are derived from the comp. */
  layers?: StudioLayer[];
  /** Supply the Composition. Receives the live props signal so form edits
      refresh without a rebuild. May be async (lazy / code-split). */
  load(props: ReadonlySignal<P>): Composition | Promise<Composition>;
}

export type Registry = {
  /** Lightweight catalog rows — id + metadata, no compositions built. */
  entries(): RegistryEntry[];
  /** Build/load (memoized) the composition for an id, wiring its props signal. */
  load(id: string, props: ReadonlySignal<Record<string, unknown>>): Promise<Composition>;
  /** The already-loaded instance for an id, if any (sync). */
  peek(id: string): Composition | undefined;
  /** Swap an entry's builder + drop its cached composition, then notify
      listeners. Used for dev hot-reload of composition source. */
  update(id: string, load: RegistryEntry["load"]): void;
  /** Subscribe to entry changes (id passed to listener). Returns unsubscribe. */
  onChange(listener: (id: string) => void): () => void;
};

/* ============================================================ render (mock) */

export type RenderKind = "video" | "still";
export type RenderStatus = "queued" | "rendering" | "done" | "canceled" | "error";

export type RenderRequest = {
  /** Composition id in the registry (= route segment). */
  id: string;
  kind: RenderKind;
  /** Display title for the queue row. */
  comp: string;
  props?: Record<string, unknown>;
  format: string;
  quality: string;
  w: number;
  h: number;
  fps: number;
  frames: number;
  rangeLabel: string;
  sizeEst: number;
  frameNo?: number;
};

export type RenderJob = RenderRequest & {
  /** Unique per queued job (distinct from the composition `id`). */
  jobId: string;
  status: RenderStatus;
  progress: number;
  createdAt: number;
  result?: string;
  error?: string;
};

/**
 * The transport contract the studio is given via `<Studio render={...}>`. The
 * package ships none — a host wires this to an in-process call, SSE, polling, a
 * websocket, or (here) a client-side mock. The store hands the queued job and an
 * `onUpdate(patch)` callback that pushes progress into the store; the resolved
 * patch (if any) is applied as the final state.
 */
export interface RenderBackend {
  start(
    job: RenderJob,
    onUpdate: (patch: Partial<RenderJob>) => void,
  ): Promise<Partial<RenderJob> | undefined>;
  /** Optional — cancel an in-flight job. */
  cancel?(jobId: string): void;
  /** Optional — fetch/download a finished result. */
  download?(job: RenderJob): void;
}

/* ============================================================ toasts */

export type Toast = {
  id: string;
  title: string;
  icon?: IconName;
};
