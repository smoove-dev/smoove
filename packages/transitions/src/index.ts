export {
  GlCompositor,
  type GlPlatform,
  getCompositor,
  setCompositorFactory,
} from "./gl/compositor.js";
export { glTransition } from "./gl/gl-transition.js";
export { type GlContext, VERTEX_SHADER, VERTEX_SHADER_100 } from "./gl/shared.js";
export { transpileTo100 } from "./gl/transpile.js";
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
export type { GlUniforms, Presentation, PresentationDims, Timing } from "./types.js";
