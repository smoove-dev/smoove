/**
 * What the media tools (`smoove agent media_info`, `transcribe`, `cut_plan` and
 * the rest) read and write. Times are source seconds; paths are relative to
 * the project root. Types and constants only, like the rest of this entry.
 */
import type { ErrorCode } from "./index.js";

/** Analysis cache and job files, one folder per source: `<name>-<key>/`. */
export const MEDIA_DIR = ".smoove/media";
/** Footage copied whole into the project, ignored by git. */
export const FOOTAGE_DIR = "footage";
/** Transcripts, committed: the agent's corrections live here. */
export const TRANSCRIPTS_DIR = "transcripts";
export const ASSETS_DIR = "assets";
export const CREDITS_FILE = "assets/credits.json";
/** Where local models and their runtime go. Default `~/.cache/smoove`. */
export const CACHE_DIR_ENV = "SMOOVE_CACHE_DIR";
export const TRANSCRIBE_URL_ENV = "SMOOVE_TRANSCRIBE_URL";
export const TRANSCRIBE_KEY_ENV = "SMOOVE_TRANSCRIBE_KEY";
export const TRANSCRIBE_MODEL_ENV = "SMOOVE_TRANSCRIBE_MODEL";

export interface TimeRange {
  start: number;
  end: number;
}

export interface MediaInfo {
  source: string;
  /** What the file is. A still image has no tracks and no duration. */
  kind?: "video" | "audio" | "image";
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  /** Display size, after rotation (a video's rotation, a photo's EXIF orientation). */
  width?: number;
  height?: number;
  /** The picture's shape at its display size. */
  shape?: "portrait" | "landscape" | "square";
  fps?: number;
  rotation?: 0 | 90 | 180 | 270;
  videoCodec?: string;
  audioCodec?: string;
  sampleRate?: number;
  channels?: number;
}

export interface AudioPeak {
  time: number;
  /** How far the moment stands above the clip's typical level. */
  aboveTypicalDb: number;
}

export interface AudioMap {
  source: string;
  duration: number;
  /** The clip's typical speech level. */
  typicalDb: number;
  /** Below this is quiet. */
  thresholdDb: number;
  quiet: TimeRange[];
  speech: TimeRange[];
  peaks: AudioPeak[];
  /** Loudness curve samples per second. */
  curveHz: number;
  curveDb: number[];
}

export interface VideoMap {
  source: string;
  from: number;
  to: number;
  /** Samples per second. */
  sampleRate: number;
  black: TimeRange[];
  white: TimeRange[];
  frozen: TimeRange[];
  /** Times the picture cuts. */
  shots: number[];
}

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface Transcript {
  source: string;
  duration: number;
  language: string | null;
  engine: "import" | "local" | "api";
  /** Word times spread across subtitle cues, not measured per word. */
  estimatedTimes?: boolean;
  words: TranscriptWord[];
}

export interface CutSegment {
  start: number;
  end: number;
  label?: string;
}

/** `compositions/<id>/cuts.json`: the ranges of the source a recut plays. */
export interface CutPlan {
  source: string;
  fps: number;
  segments: CutSegment[];
  seconds: number;
}

export interface AssetRecord {
  file: string;
  kind: "image" | "audio" | "video" | "screenshot";
  source: string;
  page: string | null;
  title: string | null;
  license: string | null;
  author: string | null;
  /** ISO date. */
  added: string;
}

export type MediaJobKind = "media_audio" | "media_video" | "transcribe";

/** `.smoove/media/<name>-<key>/jobs/<kind>.json` */
export interface MediaJob {
  /** `<kind>.<name>-<key>` */
  id: string;
  kind: MediaJobKind;
  source: string;
  status: "running" | "done" | "error";
  /** 0..1 */
  progress: number;
  message: string;
  pid: number;
  started: string;
  updated: string;
  result?: string[];
  error?: { code: ErrorCode; message: string };
}
