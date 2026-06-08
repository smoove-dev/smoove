import type { Composition } from "@konva-motion/core";
import type { VideoSourceFactory } from "@konva-motion/core";

/** ffmpeg encode tuning. */
export interface QualityConfig {
  /** x264 constant rate factor (lower = better quality / bigger file). */
  crf: number;
  /** x264 speed/efficiency preset. */
  preset: string;
  /** AAC audio bitrate, e.g. "128k". */
  audioBitrate: string;
}

export type QualityPreset = "low" | "medium" | "high" | "max";

export const QUALITY_PRESETS: Record<QualityPreset, QualityConfig> = {
  low: { crf: 28, preset: "veryfast", audioBitrate: "96k" },
  medium: { crf: 23, preset: "fast", audioBitrate: "128k" },
  high: { crf: 18, preset: "slow", audioBitrate: "192k" },
  max: { crf: 14, preset: "slower", audioBitrate: "256k" },
};

/** How a native-size frame is fitted into a different target resolution. */
export type Fit = "contain" | "cover";

export interface Resolution {
  width: number;
  height: number;
}

/** Fonts to register with skia-canvas before drawing text (no DOM `@font-face`). */
export type FontsOption = readonly string[] | Record<string, string | readonly string[]>;

/** Inclusive frame range `[from, to]`. */
export interface FrameRange {
  from: number;
  to: number;
}

export interface RenderProgress {
  /** Frames encoded so far. */
  frame: number;
  /** Total frames in the render. */
  total: number;
  /** Throughput in encoded frames per second. */
  fps: number;
  etaSeconds?: number;
}

export interface RenderOptions {
  /** Output file path. */
  output: string;
  /** Target resolution; defaults to the composition's native size. */
  resolution?: Resolution;
  /** Fit mode when `resolution` differs from native aspect. Default `"contain"`. */
  fit?: Fit;
  quality?: QualityPreset | QualityConfig;
  /** Frame rate of the output; defaults to the composition's fps. */
  fps?: number;
  range?: FrameRange;
  /** Container/codec hint. Default `"mp4"` (H.264 + AAC). */
  format?: string;
  fonts?: FontsOption;
  /** Drop all audio. */
  mute?: boolean;
  /** Override the ffmpeg binary path (defaults to `@ffmpeg-installer/ffmpeg`). */
  ffmpegPath?: string;
  signal?: AbortSignal;
  onProgress?: (progress: RenderProgress) => void;
}

export interface StreamOptions extends Omit<RenderOptions, "output"> {
  /** Fragmented container for piping. Default `"mp4"`. */
  format?: "mp4" | "webm";
}

export interface StillOptions {
  frame: number;
  /** Optional file to write; the PNG/JPEG buffer is always returned. */
  output?: string;
  resolution?: Resolution;
  fit?: Fit;
  type?: "png" | "jpeg";
  /** JPEG quality 0..1. */
  quality?: number;
  fonts?: FontsOption;
}

export interface FrameOptions {
  range?: FrameRange;
  /** Reserved — frames are yielded at native size; resampling happens in the encoder. */
  resolution?: Resolution;
  fit?: Fit;
  fonts?: FontsOption;
  signal?: AbortSignal;
}

export interface RenderedFrame {
  /** 0-based index within the render. */
  index: number;
  /** Absolute composition frame. */
  frame: number;
  /** Raw RGBA pixels, `width * height * 4` bytes. */
  data: Buffer;
  width: number;
  height: number;
}

export interface RenderResult {
  output: string;
  width: number;
  height: number;
  frames: number;
  durationInSeconds: number;
  hasAudio: boolean;
}

export interface CompositionInfo {
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  durationInSeconds: number;
  isRendering: boolean;
}

/** A point in a per-clip volume envelope; `time` is clip-relative seconds. */
export interface VolumeKeyframe {
  time: number;
  volume: number;
}

/** A coalesced run of per-frame audio samples for one source. */
export interface AudioClip {
  id: string;
  src: string;
  /** First composition frame of the run (inclusive). */
  startFrame: number;
  /** Last composition frame of the run (inclusive). */
  endFrame: number;
  /** Source in-point in seconds (first sample's mediaTime). */
  mediaInSeconds: number;
  playbackRate: number;
  /** Constant level, or a time-keyed envelope when the volume varies. */
  volume: number | VolumeKeyframe[];
}

export interface SetupOptions {
  /** Override the default server VideoSource factory. */
  video?: VideoSourceFactory;
  /** Fonts to register via skia-canvas `FontLibrary.use`. */
  fonts?: FontsOption;
  /**
   * Cap the decode resolution of node video sources (clips larger are scaled
   * down, preserving aspect; Konva upscales to the display box). skia-canvas
   * retains every distinct decoded frame's pixels for the process lifetime, so
   * a lower cap keeps memory bounded on long, video-heavy renders. Omit for
   * full-resolution decode.
   */
  videoDecodeCap?: { width: number; height: number };
}

export interface RenderToStreamResult {
  stream: import("node:stream").Readable;
  done: Promise<RenderResult>;
}

/** Internal helper alias. */
export type Comp = Composition;
