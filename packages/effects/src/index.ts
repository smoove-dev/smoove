export { Effect, type EffectConfig } from "./effect.js";
export { type BlurConfig, BlurEffect } from "./filters/blur.js";
export {
  type ChromaticAberrationConfig,
  ChromaticAberrationEffect,
} from "./filters/chromatic-aberration.js";
export { type ColorKeyConfig, ColorKeyEffect } from "./filters/color-key.js";
export { type GlowConfig, GlowEffect } from "./filters/glow.js";
export { type HeatmapConfig, HeatmapEffect } from "./filters/heatmap.js";
export { type NoiseGrainConfig, NoiseGrainEffect } from "./filters/noise-grain.js";
export { type PixelateConfig, PixelateEffect } from "./filters/pixelate.js";
export { type VignetteConfig, VignetteEffect } from "./filters/vignette.js";
export { type WaterConfig, WaterEffect } from "./filters/water.js";
export { ImageShaderSource, type ImageShaderSourceConfig } from "./image-source.js";
export { type ParamSchema, type ParamSpec, type ParamType, parseColorVec4 } from "./params.js";
export type { EffectGlPlatform } from "./runtime/platform.js";
export { EffectRuntime, ensureEffectRuntime, setEffectPlatformFactory } from "./runtime/runtime.js";
// The flip-aware WebGL1 vertex shader (u_flipY): server platforms must pair the
// effects runtime with THIS shader, not a vertex shader that hard-codes the flip —
// intermediate ping-pong passes must not flip or even-length chains invert.
export { VERTEX_SHADER_100 } from "./runtime/shared.js";
export { ShaderSource, type ShaderSourceConfig } from "./source.js";
export { ColorPanels, type ColorPanelsConfig } from "./sources/color-panels.js";
export { Dithering, type DitheringConfig } from "./sources/dithering.js";
export { DotGrid, type DotGridConfig } from "./sources/dot-grid.js";
export { DotOrbit, type DotOrbitConfig } from "./sources/dot-orbit.js";
export { GemSmoke, type GemSmokeConfig } from "./sources/gem-smoke.js";
export { GodRays, type GodRaysConfig } from "./sources/god-rays.js";
export { GrainGradient, type GrainGradientConfig } from "./sources/grain-gradient.js";
export { Heatmap, type HeatmapConfig as HeatmapImageConfig } from "./sources/heatmap-image.js";
export { LiquidMetal, type LiquidMetalConfig } from "./sources/liquid-metal.js";
export { MeshGradient, type MeshGradientConfig } from "./sources/mesh-gradient.js";
export { Metaballs, type MetaballsConfig } from "./sources/metaballs.js";
export { NeuroNoise, type NeuroNoiseConfig } from "./sources/neuro-noise.js";
export { PerlinNoise, type PerlinNoiseConfig } from "./sources/perlin-noise.js";
export { PulsingBorder, type PulsingBorderConfig } from "./sources/pulsing-border.js";
export { SimplexNoise, type SimplexNoiseConfig } from "./sources/simplex-noise.js";
export { SmokeRing, type SmokeRingConfig } from "./sources/smoke-ring.js";
export { Spiral, type SpiralConfig } from "./sources/spiral.js";
export {
  StaticMeshGradient,
  type StaticMeshGradientConfig,
} from "./sources/static-mesh-gradient.js";
export {
  StaticRadialGradient,
  type StaticRadialGradientConfig,
} from "./sources/static-radial-gradient.js";
export { Swirl, type SwirlConfig } from "./sources/swirl.js";
export { Voronoi, type VoronoiConfig } from "./sources/voronoi.js";
export { Warp, type WarpConfig } from "./sources/warp.js";
export { Waves, type WavesConfig } from "./sources/waves.js";
