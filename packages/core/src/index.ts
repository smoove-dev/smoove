export { Easing } from "./animation/easing.js";
export {
  type ExtrapolateType,
  type InterpolateOptions,
  interpolate,
} from "./animation/interpolate.js";
export { interpolateColors } from "./animation/interpolate-colors.js";
export {
  type AncestryMethods,
  findClip,
  findComposition,
  findSequence,
} from "./engine/ancestry.js";
export { Clip, type ClipOptions, isClip } from "./engine/clip.js";
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
  type FrameAnchor,
  Marker,
  type MarkerKind,
  type MarkerOptions,
  MarkerPoint,
  type MarkerSource,
  type PlanStep,
  plan,
  // @internal — anchor resolution reused by @smoove/transitions.
  resolveFrameAnchor,
  type ScenePlacement,
} from "./engine/marker.js";
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
  type FrameInfo,
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
export { createSignal, type ReadonlySignal, type Signal } from "./engine/signal.js";
// Type-only on purpose: timeline.js participates in an import cycle with
// composition.js/sequence.js and must never be the first module of that
// cluster to evaluate — see the ordering note in timeline.ts.
export type { QuerySelector, TimelineOptions } from "./engine/timeline.js";
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
  type LocalMeasuredLine,
  type MeasureContext,
} from "./layout/contract.js";
export {
  // @internal — flex sizing helpers reused by @smoove/media's Video node.
  applySize,
  type FlexilyNode,
  parseSize,
} from "./layout/flex/engine.js";
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
// smoove's plain container: a marker-stamped Konva.Group, so apps get the full
// drawing vocabulary from core without reaching into `Konva.*`. For automatic
// layout use `Flex`/`Block`; `Group` is the manual transform/grouping container.
export { Group, type GroupConfig, isGroupNode } from "./layout/group.js";
export {
  Image,
  type ImageConfig,
  type ObjectFit,
  type ObjectPosition,
} from "./layout/image.js";
export {
  type MeasuredLine,
  type MeasuredRect,
  type Measurement,
  type MeasureOptions,
  measure,
} from "./layout/measure.js";
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
export {
  AUDIO_MARK,
  CLIP_MARK,
  FONT_MARK,
  GROUP_MARK,
  isAudioNode,
  isClipNode,
  isTimelineNode,
  isVideoNode,
  MEDIA_MARK,
  TICK_MARK,
  TIMELINE_MARK,
  VIDEO_MARK,
} from "./markers.js";
export type { AudioAsset } from "./media/audio/asset.js";
export type { AudioSource, AudioSourceFactory } from "./media/audio/audio-source.js";
export { type AudioChannel, AudioMixer } from "./media/audio/mixer.js";
export { getMediaTime, type MediaTiming } from "./media/media-time.js";
export type { SeekMode, VideoSource, VideoSourceFactory } from "./media/video/video-source.js";
