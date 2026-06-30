// High-level render API

export { mixAudio } from "./audio-mix.js";
export { NullAudioSource, nullAudioSourceFactory } from "./audio-source-null.js";
export { collectAudioTrack } from "./audio-track.js";
export { DEFAULT_FONT_CACHE_DIR, makeSkiaFontLoader } from "./font-loader.js";
export { loadImageNode } from "./image-loader.js";
export { registerServerMedia } from "./media-server.js";
export { probeComposition } from "./probe.js";
export {
  renderComposition,
  renderFrames,
  renderStill,
  renderToStream,
} from "./render.js";
// Wiring seams (call before building compositions)
export { registerFonts, setupServerRendering } from "./setup.js";
export { installSkiaBackend } from "./skia.js";
// Types
export {
  type AudioClip,
  type CompositionInfo,
  type Fit,
  type FontsOption,
  type FrameOptions,
  type FrameRange,
  QUALITY_PRESETS,
  type QualityConfig,
  type QualityPreset,
  type RenderedFrame,
  type RenderOptions,
  type RenderProgress,
  type RenderResult,
  type RenderToStreamResult,
  type Resolution,
  type SetupOptions,
  type StillOptions,
  type StreamOptions,
  type VolumeKeyframe,
} from "./types.js";
export {
  MediabunnyVideoSource,
  nodeVideoSourceFactory,
  setVideoDecodeCap,
} from "./video-source-mediabunny.js";
