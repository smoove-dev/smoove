// High-level render API
export {
  renderComposition,
  renderToStream,
  renderStill,
  renderFrames,
} from "./render.js";
export { collectAudioTrack } from "./audio-track.js";
export { probeComposition } from "./probe.js";

// Wiring seams (call before building compositions)
export { setupServerRendering, registerFonts } from "./setup.js";
export { registerServerMedia } from "./media-server.js";
export { installSkiaBackend } from "./skia.js";
export { loadImageNode } from "./image-loader.js";
export {
  nodeVideoSourceFactory,
  MediabunnyVideoSource,
  setVideoDecodeCap,
} from "./video-source-mediabunny.js";
export { nullAudioSourceFactory, NullAudioSource } from "./audio-source-null.js";
export { mixAudio } from "./audio-mix.js";

// Types
export {
  QUALITY_PRESETS,
  type QualityConfig,
  type QualityPreset,
  type Fit,
  type Resolution,
  type FontsOption,
  type FrameRange,
  type RenderProgress,
  type RenderOptions,
  type StreamOptions,
  type StillOptions,
  type FrameOptions,
  type RenderedFrame,
  type RenderResult,
  type RenderToStreamResult,
  type CompositionInfo,
  type VolumeKeyframe,
  type AudioClip,
  type SetupOptions,
} from "./types.js";
