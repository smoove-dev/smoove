export {
  TransitionSeries,
  type TransitionSeriesOptions,
  type TransitionSeriesSceneOptions,
  type TransitionSeriesTransitionOptions,
} from "./transition-series.js";

export type { GlUniforms, Presentation, PresentationDims, Timing } from "./types.js";

export {
  linearTiming,
  type LinearTimingOptions,
  springTiming,
  type SpringTimingOptions,
  type SpringConfig,
  defaultSpringConfig,
  measureSpring,
  spring,
} from "./timings/index.js";

export * from "./presentations/index.js";

export {
  getCompositor,
  GlCompositor,
  type GlPlatform,
  setCompositorFactory,
} from "./gl/compositor.js";
export { glTransition } from "./gl/gl-transition.js";
export { type GlContext, VERTEX_SHADER, VERTEX_SHADER_100 } from "./gl/shared.js";
export { transpileTo100 } from "./gl/transpile.js";
