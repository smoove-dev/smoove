import type { GlUniforms, Presentation, PresentationDims } from "../types.js";

/**
 * Wrap a fragment shader (+ optional per-effect uniforms) into a Tier B
 * `Presentation`. The shared GL compositor supplies `u_time`/`u_prev`/`u_next`;
 * `uniforms` returns everything else this shader needs for the frame.
 */
export function glTransition(
  fragment: string,
  uniforms?: (progress: number, dims: PresentationDims) => GlUniforms,
): Presentation {
  return { gl: { fragment, uniforms } };
}
