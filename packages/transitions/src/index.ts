// The WebGL bridge moved to @smoove/core so @smoove/effects can run shader
// passes without depending on this package. Re-exported here unchanged, so
// existing imports from @smoove/transitions keep working.
export {
  GlCompositor,
  type GlContext,
  type GlPlatform,
  type GlUniforms,
  getCompositor,
  setCompositorFactory,
  transpileTo100,
  VERTEX_SHADER,
  VERTEX_SHADER_100,
} from "@smoove/core";
export { glTransition } from "./gl/gl-transition.js";
export * from "./presentations/index.js";
export {
  defaultSpringConfig,
  type LinearTimingOptions,
  linearTiming,
  measureSpring,
  type SpringConfig,
  type SpringTimingOptions,
  spring,
  springTiming,
} from "./timings/index.js";
export {
  TransitionSeries,
  type TransitionSeriesOptions,
  type TransitionSeriesSceneOptions,
  type TransitionSeriesTransitionOptions,
} from "./transition-series.js";
export type { Presentation, PresentationDims, Timing } from "./types.js";
