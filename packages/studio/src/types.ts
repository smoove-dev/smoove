import type { Composition, ReadonlySignal } from "@konva-motion/core";
import type { IconName } from "./components/icon/paths.js";
import type { LayerKind } from "./lib/constants.js";
import type { KmSchema } from "./schema/types.js";

/** A signal you can both read and write. The store owns the writable side and
    pushes form edits onto the composition via `comp.setProps`. */
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

/** The composition for an entry: a ready instance, or a (lazy / code-split)
    loader resolving to one. A loader may resolve to a module namespace whose
    `default` export is the Composition — the registry unwraps it.

    Typed against `Composition<any>` on purpose: the registry is props-shape
    agnostic, and `Composition<P>` is invariant in `P` (via `setProps`), so a
    concretely-typed `Composition<MyProps>` would not otherwise be assignable. */
// biome-ignore lint/suspicious/noExplicitAny: framework boundary erases the props shape.
type AnyComposition = Composition<any>;
export type CompositionInput =
  | AnyComposition
  | (() => AnyComposition | Promise<AnyComposition> | Promise<{ default: AnyComposition }>);

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
  /** The Composition (default-exported), or a lazy loader resolving to one.
      Props live on the comp's `props` signal — set via `comp.setProps`. */
  composition: CompositionInput;
}

export type Registry = {
  /** Lightweight catalog rows — id + metadata, no compositions built. */
  entries(): RegistryEntry[];
  /** Resolve (memoized) the composition for an id. */
  load(id: string): Promise<Composition>;
  /** The already-loaded instance for an id, if any (sync). */
  peek(id: string): Composition | undefined;
  /** Swap an entry's composition + drop its cached instance, then notify
      listeners. Used for dev hot-reload of composition source. */
  update(id: string, composition: CompositionInput): void;
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
  /** Absolute composition frame range for a partial (region) render. When
      omitted the whole composition is rendered. `to` is inclusive. */
  from?: number;
  to?: number;
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
