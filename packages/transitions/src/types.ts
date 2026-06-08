import type Konva from "konva";

/** Scene dimensions handed to a presentation — the Composition stage size. */
export type PresentationDims = { width: number; height: number };

/**
 * Extra (per-effect) uniforms a GL presentation uploads each frame, keyed by
 * GLSL uniform name. A `number` → `uniform1f`; a `number[]` of length 2/3/4 →
 * `uniform2f`/`uniform3f`/`uniform4f`.
 */
export type GlUniforms = Record<string, number | number[]>;

/**
 * How a transition renders. A geometric (Tier A) presentation implements
 * `enter`/`exit`, mutating the incoming/outgoing `Konva.Layer` directly. A
 * shader (Tier B) presentation instead provides `gl` — a fragment shader the
 * shared WebGL compositor runs over both captured layers.
 */
export type Presentation = {
  /** Apply the incoming layer's state at `progress` (0 → fully out, 1 → in). */
  enter?(layer: Konva.Layer, progress: number, dims: PresentationDims): void;
  /** Apply the outgoing layer's state at `progress` (0 → fully in, 1 → out). */
  exit?(layer: Konva.Layer, progress: number, dims: PresentationDims): void;
  /** GLSL fragment shader + uniform wiring for a Tier B (shader) transition. */
  gl?: {
    fragment: string;
    /** Per-effect uniforms (beyond `u_time`/`u_prev`/`u_next`) for this frame. */
    uniforms?(progress: number, dims: PresentationDims): GlUniforms;
  };
};

/**
 * Maps a transition's local frame onto a `[0, 1]` progress and reports its
 * length in frames. Pure/deterministic so transitions render identically
 * offline.
 */
export type Timing = {
  getDurationInFrames(fps: number): number;
  getProgress(localFrame: number, fps: number): number;
};
