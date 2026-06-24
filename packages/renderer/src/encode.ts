import type { Writable } from "node:stream";
import {
  AppendOnlyStreamTarget,
  AudioSample,
  AudioSampleSource,
  FilePathTarget,
  Mp4OutputFormat,
  Output,
  type Target,
  VideoSample,
  VideoSampleSource,
  WebMOutputFormat,
} from "mediabunny";
import type { QualityConfig } from "./types.js";

/** Output PCM format the audio mixer produces and the encoder consumes. */
export const AUDIO_SAMPLE_RATE = 48_000;
export const AUDIO_CHANNELS = 2;

export type EncodeTarget =
  | { kind: "file"; path: string }
  /** A node stream to pipe a fragmented container into (for `renderToStream`). */
  | { kind: "stream"; writable: Writable };

export interface EncoderOptions {
  width: number;
  height: number;
  fps: number;
  format: "mp4" | "webm";
  quality: QualityConfig;
  hasAudio: boolean;
  target: EncodeTarget;
}

/**
 * Single-pass video+audio encoder built on Mediabunny's {@link Output}. Replaces
 * the old two-pass ffmpeg flow (raw-RGBA pipe → temp file → mux): video frames
 * are added as {@link VideoSample}s, mixed audio as {@link AudioSample}s, and one
 * `finalize()` muxes the container — no temp files, no child processes.
 */
export class MediabunnyEncoder {
  private readonly _output: Output;
  private readonly _video: VideoSampleSource;
  private readonly _audio: AudioSampleSource | null;
  private readonly _width: number;
  private readonly _height: number;

  constructor(opts: EncoderOptions) {
    this._width = opts.width;
    this._height = opts.height;

    const streaming = opts.target.kind === "stream";
    const target: Target =
      opts.target.kind === "file"
        ? new FilePathTarget(opts.target.path)
        : new AppendOnlyStreamTarget(nodeWritableToWeb(opts.target.writable));

    // Streaming wants a sequential, fragmented container; files get an
    // in-memory fast-start so the moov atom lands up front (web-playable).
    const format =
      opts.format === "webm"
        ? new WebMOutputFormat()
        : new Mp4OutputFormat({ fastStart: streaming ? "fragmented" : "in-memory" });

    this._output = new Output({ format, target });

    const videoCodec = opts.format === "webm" ? "vp9" : "avc";
    this._video = new VideoSampleSource({ codec: videoCodec, bitrate: opts.quality.videoBitrate });
    this._output.addVideoTrack(this._video, { frameRate: opts.fps });

    if (opts.hasAudio) {
      const audioCodec = opts.format === "webm" ? "opus" : "aac";
      this._audio = new AudioSampleSource({
        codec: audioCodec,
        bitrate: opts.quality.audioBitrate,
      });
      this._output.addAudioTrack(this._audio);
    } else {
      this._audio = null;
    }
  }

  start(): Promise<void> {
    return this._output.start();
  }

  /** Add one RGBA frame (`width*height*4` bytes) at `timestamp` seconds. */
  async addFrame(rgba: Uint8Array, timestamp: number, duration: number): Promise<void> {
    const sample = new VideoSample(rgba, {
      format: "RGBA",
      codedWidth: this._width,
      codedHeight: this._height,
      timestamp,
      duration,
    });
    try {
      await this._video.add(sample);
    } finally {
      sample.close();
    }
  }

  /** Add a chunk of interleaved f32 PCM ({@link AUDIO_CHANNELS} @ {@link AUDIO_SAMPLE_RATE}). */
  async addAudioChunk(data: Float32Array, timestamp: number): Promise<void> {
    if (!this._audio) return;
    const sample = new AudioSample({
      data,
      format: "f32",
      numberOfChannels: AUDIO_CHANNELS,
      sampleRate: AUDIO_SAMPLE_RATE,
      timestamp,
    });
    try {
      await this._audio.add(sample);
    } finally {
      sample.close();
    }
  }

  finalize(): Promise<void> {
    return this._output.finalize();
  }

  cancel(): Promise<void> {
    return this._output.cancel();
  }
}

/** Bridge a node {@link Writable} to a web {@link WritableStream} for streaming targets. */
function nodeWritableToWeb(node: Writable): WritableStream<Uint8Array> {
  return new WritableStream<Uint8Array>({
    write(chunk) {
      return new Promise((resolve, reject) => {
        node.write(chunk, (err) => (err ? reject(err) : resolve()));
      });
    },
    close() {
      node.end();
    },
    abort(reason) {
      node.destroy(reason instanceof Error ? reason : new Error(String(reason)));
    },
  });
}
