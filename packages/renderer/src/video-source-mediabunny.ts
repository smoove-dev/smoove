import type { Environment, VideoSource, VideoSourceFactory } from "@smoove/core";
import { ALL_FORMATS, Input, type VideoSample, VideoSampleSink } from "mediabunny";
import { Canvas, ImageData, type CanvasRenderingContext2D as SkiaContext } from "skia-canvas";
import { makeInputSource } from "./media-input-source.js";

type SeekMode = "precise" | "fast";

/** Reuse the current frame within a quarter of a 60fps tick before seeking. */
const SAME_FRAME_EPS = 1 / 240;
/** Forward jumps larger than this restart the decode iterator instead of decoding through. */
const BIGGEST_FORWARD_JUMP = 3;

// Optional decode-resolution cap (0 = uncapped). Mediabunny decode is memory-
// bounded (one reused canvas, cleared each frame), so this is now purely a
// throughput/size knob for large background clips, not a leak workaround.
let DECODE_MAX_W = 0;
let DECODE_MAX_H = 0;

/** Cap the decode/blit resolution of node video sources (0,0 = uncapped). */
export function setVideoDecodeCap(maxWidth: number, maxHeight: number): void {
  DECODE_MAX_W = Math.max(0, Math.floor(maxWidth));
  DECODE_MAX_H = Math.max(0, Math.floor(maxHeight));
}

/**
 * Server-side {@link VideoSource} backed by Mediabunny + node-av (FFmpeg C API).
 * The Node analogue of core's browser `MediabunnyVideoSource`: a forward-only
 * {@link VideoSampleSink} iterator decodes frames for the exact timestamp the
 * frame clock asks for; each decoded {@link VideoSample} is copied (RGBA) onto a
 * reused skia `Canvas` that serves as the drawable {@link element} for
 * `Konva.Image`. Replaces the old `FfmpegVideoSource` (one ffmpeg child process
 * per clip, raw-RGBA pipe, manual frame reassembly).
 */
export class MediabunnyVideoSource implements VideoSource {
  private _canvas: Canvas | null = null;
  private _ctx: SkiaContext | null = null;
  private _scratch: Canvas | null = null;
  private _scratchCtx: SkiaContext | null = null;
  private _imageData: ImageData | null = null;

  private _input: Input | null = null;

  private _sink: VideoSampleSink | null = null;

  private _ready = false;
  private _disposed = false;
  private readonly _readyCbs = new Set<() => void>();
  private readonly _frameCbs = new Set<() => void>();

  private _w = 0; // blit (display) size
  private _h = 0;
  private _codedW = 0;
  private _codedH = 0;
  private _duration = 0;
  private _firstTs = 0;

  private _iter: AsyncGenerator<VideoSample, void, unknown> | null = null;
  private _next: VideoSample | null = null;
  private _curTs = Number.NEGATIVE_INFINITY;

  private _seeking = false;
  private _pending: { time: number; resolvers: Array<() => void> } | null = null;

  async load(src: string): Promise<void> {
    const input = new Input({ formats: ALL_FORMATS, source: makeInputSource(src) });
    this._input = input;
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(`[smoove] no video track in: ${src}`);
    if (!(await track.canDecode())) {
      throw new Error(`[smoove] cannot decode video track in: ${src}`);
    }
    if (this._disposed) return;

    const dw = await track.getDisplayWidth();
    const dh = await track.getDisplayHeight();
    let w = dw;
    let h = dh;
    if (DECODE_MAX_W > 0 && DECODE_MAX_H > 0 && (dw > DECODE_MAX_W || dh > DECODE_MAX_H)) {
      const scale = Math.min(DECODE_MAX_W / dw, DECODE_MAX_H / dh);
      w = Math.max(2, Math.round((dw * scale) / 2) * 2);
      h = Math.max(2, Math.round((dh * scale) / 2) * 2);
    }
    this._w = w;
    this._h = h;
    this._duration = await track.computeDuration();
    this._firstTs = await track.getFirstTimestamp();

    this._canvas = new Canvas(w, h);
    this._ctx = this._canvas.getContext("2d");
    this._sink = new VideoSampleSink(track);

    await this._satisfy(this._firstTs);
    if (this._disposed) return;

    this._ready = true;
    for (const cb of this._readyCbs) cb();
  }

  get element(): CanvasImageSource | null {
    return this._ready ? (this._canvas as unknown as CanvasImageSource) : null;
  }

  get naturalWidth(): number {
    return this._w;
  }

  get naturalHeight(): number {
    return this._h;
  }

  get duration(): number {
    return this._duration;
  }

  get currentTime(): number {
    return this._curTs === Number.NEGATIVE_INFINITY ? 0 : this._curTs;
  }

  get isReady(): boolean {
    return this._ready;
  }

  seek(timeSeconds: number, _mode: SeekMode = "precise"): Promise<void> {
    const clamped = Math.max(
      this._firstTs,
      this._duration > 0 ? Math.min(this._duration, timeSeconds) : timeSeconds,
    );
    if (!this._seeking && Math.abs(this._curTs - clamped) <= SAME_FRAME_EPS) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      if (this._pending) {
        this._pending.time = clamped;
        this._pending.resolvers.push(resolve);
      } else {
        this._pending = { time: clamped, resolvers: [resolve] };
      }
      void this._drainSeek();
    });
  }

  private async _drainSeek(): Promise<void> {
    if (this._seeking || !this._pending) return;
    this._seeking = true;
    while (this._pending) {
      const { time, resolvers } = this._pending;
      this._pending = null;
      try {
        await this._satisfy(time);
      } catch (err) {
        if (!this._disposed) console.error("[smoove] video seek failed:", err);
      }
      for (const r of resolvers) r();
    }
    this._seeking = false;
  }

  /** Land the owned canvas on the last frame whose start timestamp is <= `t`. */
  private async _satisfy(t: number): Promise<void> {
    if (!this._sink) return;
    if (t < this._curTs - SAME_FRAME_EPS || t > this._curTs + BIGGEST_FORWARD_JUMP || !this._iter) {
      await this._restartIterator(t);
    }
    while (true) {
      if (!this._next) this._next = await this._pull();
      if (this._next && this._next.timestamp <= t + SAME_FRAME_EPS) {
        await this._draw(this._next);
        this._next = null;
      } else {
        break;
      }
    }
  }

  private async _restartIterator(t: number): Promise<void> {
    await this._iter?.return();
    this._iter = this._sink?.samples(Math.max(0, t)) ?? null;
    this._next?.close();
    this._next = null;
    this._curTs = Number.NEGATIVE_INFINITY;
    const first = await this._pull();
    if (first) await this._draw(first);
  }

  private async _pull(): Promise<VideoSample | null> {
    if (!this._iter) return null;
    const r = await this._iter.next();
    return r.done ? null : r.value;
  }

  /** Copy a decoded frame (RGBA) onto the owned canvas and notify listeners. */
  private async _draw(sample: VideoSample): Promise<void> {
    this._curTs = sample.timestamp;
    const cw = sample.codedWidth;
    const ch = sample.codedHeight;
    if (!this._imageData || this._codedW !== cw || this._codedH !== ch) {
      this._codedW = cw;
      this._codedH = ch;
      this._scratch = new Canvas(cw, ch);
      this._scratchCtx = this._scratch.getContext("2d");
      this._imageData = new ImageData(cw, ch);
    }
    await sample.copyTo(this._imageData.data, { format: "RGBA" });
    sample.close();

    const sctx = this._scratchCtx;
    const ctx = this._ctx;
    if (!sctx || !ctx) return;
    sctx.putImageData(this._imageData, 0, 0);
    // Clear before blit: skia retains a native snapshot of prior content, so an
    // uncleared draw leaks ~1 frame of RSS per frame for the process lifetime.
    ctx.clearRect(0, 0, this._w, this._h);
    if (this._scratch) ctx.drawImage(this._scratch, 0, 0, this._w, this._h);
    for (const cb of this._frameCbs) cb();
  }

  // Pull-based: nothing self-plays. The frame clock drives `seek()` each tick.
  play(): Promise<void> {
    return Promise.resolve();
  }
  pause(): void {}
  setMuted(_muted: boolean): void {}
  setVolume(_volume: number): void {}
  setPlaybackRate(_rate: number): void {}

  onReady(cb: () => void): () => void {
    if (this._ready) {
      cb();
      return () => {};
    }
    this._readyCbs.add(cb);
    return () => this._readyCbs.delete(cb);
  }

  onFrame(cb: () => void): () => void {
    this._frameCbs.add(cb);
    return () => this._frameCbs.delete(cb);
  }

  destroy(): void {
    this._disposed = true;
    void this._iter?.return();
    this._iter = null;
    this._next?.close();
    this._next = null;
    this._input?.dispose();
    this._input = null;

    this._sink = null;
    this._canvas = null;
    this._ctx = null;
    this._scratch = null;
    this._scratchCtx = null;
    this._imageData = null;
    this._readyCbs.clear();
    this._frameCbs.clear();
    this._pending = null;
  }
}

export const nodeVideoSourceFactory: VideoSourceFactory = (_env: Environment) =>
  new MediabunnyVideoSource();
