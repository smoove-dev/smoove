import type { Composition, ReadonlySignal } from "@konva-motion/core";
import type { KmSchema } from "../studio/kf.js";

/** Live, frame-preserving props passed into a demo's `build`. */
export type PropsSignal = ReadonlySignal<Record<string, unknown>>;

export type DemoDef = {
  id: string;
  name: string;
  /**
   * Build the composition. `props` is a live signal of the demo's current
   * prop values — read `props.get()` in updaters and subscribe to it to
   * re-apply the current frame when the user edits props (the playhead never
   * moves). Demos without a schema simply ignore it.
   */
  build: (container: string, width: number, height: number, props: PropsSignal) => Composition;
  /** Optional kf.object(...) schema → auto-generated props form. */
  schema?: KmSchema;
  /** Optional overrides deep-merged over the schema defaults. */
  defaultProps?: Record<string, unknown>;
};
