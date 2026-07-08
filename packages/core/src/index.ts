export { Easing } from "./animation/easing.js";
export {
  type ExtrapolateType,
  type InterpolateOptions,
  interpolate,
} from "./animation/interpolate.js";
export { interpolateColors } from "./animation/interpolate-colors.js";
export {
  applyLayerEffects,
  drawNodeWithEffects,
  initNodeEffects,
  setEffectPreviewMaxPixelRatio,
} from "./effects/apply.js";
export {
  type EffectFrameContext,
  type EffectPass,
  isSmooveEffect,
  type SmooveEffect,
  type WithEffects,
} from "./effects/contract.js";
export { getContentVersion } from "./effects/dirty.js";
export { type EffectCanvasFactory, setEffectCanvasFactory } from "./effects/passes.js";
export {
  type BufferState,
  Composition,
  type CompositionEvent,
  type CompositionEventMap,
  type CompositionEventName,
  type CompositionOptions,
  getComposition,
} from "./engine/composition.js";
export {
  detectEnvironment,
  type Environment,
  type EnvironmentMode,
  getEnvironment,
} from "./engine/environment.js";
export {
  type ComputeOffsetsResult,
  // @internal — offset engine reused by @smoove/transitions.
  computeOffsets,
  type OffsetScene,
  type PlacedScene,
} from "./engine/offsets.js";
export {
  type FontFaceDescriptor,
  type FontLoader,
  getDefaultAudioSourceFactory,
  getDefaultFontLoader,
  getDefaultImageLoader,
  getDefaultVideoSourceFactory,
  type ImageLoader,
  type LoadedImage,
  loadFontFace,
  setDefaultAudioSourceFactory,
  setDefaultFontLoader,
  setDefaultImageLoader,
  setDefaultVideoSourceFactory,
} from "./engine/runtime-defaults.js";
export {
  Sequence,
  type SequenceOptions,
  type SequenceProvider,
  type Updater,
} from "./engine/sequence.js";
export {
  Series,
  type SeriesOptions,
  type SeriesSceneOptions,
} from "./engine/series.js";
export type { ReadonlySignal } from "./engine/signal.js";
export {
  EffectShaderRunner,
  getEffectShaderRunner,
  setEffectShaderFactory,
} from "./gl/effect-runner.js";
export type { GlPlatform, GlUniforms } from "./gl/platform.js";
export {
  compileShader,
  createProgram,
  createTexture,
  type GlContext,
  VERTEX_SHADER,
  VERTEX_SHADER_100,
} from "./gl/shared.js";
export { transpileTo100 } from "./gl/transpile.js";
export {
  type BackgroundValue,
  Block,
  type BlockConfig,
  type EdgeColor,
  type GradientBackground,
  type GradientStop,
  type ShadowProps,
} from "./layout/block.js";
export {
  isKMLayoutNode,
  isKMLayoutRoot,
  type KMLayoutNode,
  type LayoutBox,
  type MeasureContext,
} from "./layout/contract.js";
export { Flex } from "./layout/flex/flex.js";
export { FlexShape, type LeafConfig } from "./layout/flex/mixin.js";
export type {
  Align,
  AlignSelf,
  EdgeValue,
  FlexChildProps,
  FlexConfig,
  FlexDirection,
  FlexProps,
  Justify,
  SizeValue,
} from "./layout/flex/types.js";
export {
  Image,
  type ImageConfig,
  type ObjectFit,
  type ObjectPosition,
} from "./layout/image.js";
export {
  Arc,
  type ArcConfig,
  Arrow,
  type ArrowConfig,
  Circle,
  type CircleConfig,
  Ellipse,
  type EllipseConfig,
  Line,
  type LineConfig,
  Path,
  type PathConfig,
  Rect,
  type RectConfig,
  RegularPolygon,
  type RegularPolygonConfig,
  Ring,
  type RingConfig,
  Sprite,
  type SpriteConfig,
  Star,
  type StarConfig,
  TextPath,
  type TextPathConfig,
  Wedge,
  type WedgeConfig,
} from "./layout/shapes.js";
export {
  Font,
  type FontConfig,
  type FontFace,
  type FontFaceRef,
  type FontStyleName,
} from "./layout/text/font.js";
export { Text } from "./layout/text/text.js";
export type {
  FitConfig,
  HighlightConfig,
  TextAlign,
  TextConfig,
  TypewriterConfig,
} from "./layout/text/types.js";
export type { AudioAsset } from "./media/audio/asset.js";
export type { AudioSource, AudioSourceFactory } from "./media/audio/audio-source.js";
export { BrowserAudioSource } from "./media/audio/audio-source-browser.js";
export {
  MediabunnyAudioSource,
  type SchedulableAudioSource,
} from "./media/audio/audio-source-mediabunny.js";
export { Audio, isAudioNode } from "./media/audio/index.js";
export { type AudioChannel, AudioMixer } from "./media/audio/mixer.js";
export type { AudioConfig } from "./media/audio/types.js";
export { getMediaTime, type MediaTiming } from "./media/media-time.js";
export { isVideoNode, Video } from "./media/video/index.js";
export type { VideoConfig } from "./media/video/types.js";
export type { VideoSource, VideoSourceFactory } from "./media/video/video-source.js";
export { BrowserVideoSource } from "./media/video/video-source-browser.js";
export { MediabunnyVideoSource } from "./media/video/video-source-mediabunny.js";
