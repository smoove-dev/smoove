import type { Composition } from "@konva-motion/core";
import type { VideoSourceFactory } from "@konva-motion/core";
import {
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_VERY_HIGH,
  type Quality,
} from "mediabunny";

/**
 * Encode tuning. Mediabunny encoders are bitrate-oriented (no CRF): a value is
 * either a target bitrate in bits/second or one of Mediabunny's resolution-aware
 * {@link Quality} constants (`QUALITY_LOW` … `QUALITY_VERY_HIGH`).
 */
export interface QualityConfig {
  /** Target video bitrate (bits/second) or a Mediabunny quality constant. */
  videoBitrate: number | Quality;
  /** Target audio bitrate (bits/second) or a Mediabunny quality constant. */
  audioBitrate: number | Quality;
}

export type QualityPreset = "low" | "medium" | "high" | "max";

export const QUALITY_PRESETS: Record<QualityPreset, QualityConfig> = {
  low: { videoBitrate: QUALITY_LOW, audioBitrate: 96_000 },
  medium: { videoBitrate: QUALITY_MEDIUM, audioBitrate: 128_000 },
  high: { videoBitrate: QUALITY_HIGH, audioBitrate: 192_000 },
  max: { videoBitrate: QUALITY_VERY_HIGH, audioBitrate: 256_000 },
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
  /** Output container. `"mp4"` (H.264 + AAC, default) or `"webm"` (VP9 + Opus). */
  format?: "mp4" | "webm";
  fonts?: FontsOption;
  /** Drop all audio. */
  mute?: boolean;
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
   * Cap the decode/blit resolution of node video sources (clips larger are
   * scaled down, preserving aspect; Konva upscales to the display box). An
   * optional throughput/size knob for large background clips — Mediabunny decode
   * is already memory-bounded. Omit for full-resolution decode.
   */
  videoDecodeCap?: { width: number; height: number };
}

export interface RenderToStreamResult {
  stream: import("node:stream").Readable;
  done: Promise<RenderResult>;
}

/** Internal helper alias. */
export type Comp = Composition;
