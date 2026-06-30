import {
  ALL_FORMATS,
  AudioBufferSink,
  CanvasSink,
  Input,
  UrlSource,
  type WrappedCanvas,
} from "mediabunny";
import type { SchedulableAudioSource } from "../audio/audio-source-mediabunny.js";
import type { SeekMode, VideoSource } from "./video-source.js";

/** Reuse decoded frames within this window before issuing a seek (1/4 of a 60fps frame). */
const SAME_FRAME_EPS = 1 / 240;
/** Forward jumps larger than this restart the decode iterator instead of decoding through. */
const BIGGEST_FORWARD_JUMP = 3;
/** Canvas pool size — holds the current lookahead frame plus one in flight. */
const POOL_SIZE = 2;

/**
 * Preview-mode {@link VideoSource} backed by Mediabunny + WebCodecs. Replaces the
 * `HTMLVideoElement`-based {@link BrowserVideoSource}: instead of a self-playing
 * element corrected for drift, frames are **pulled** for the exact timestamp the
 * frame clock asks for, so scrubbing and playback are frame-accurate.
 *
 * Decoding uses a forward-only {@link CanvasSink} iterator (the cheap path for
 * playback); the iterator is torn down and reseeded only on a backward seek or a
 * large forward jump. Each decoded frame is blitted onto a single owned canvas so
 * {@link element} keeps a stable reference for `Konva.Image`.
 *
 * The same {@link Input} also exposes the file's audio track as an
 * {@link AudioBufferSink} (so a `Video` with sound is decoded once, not twice),
 * which is why this also satisfies {@link SchedulableAudioSource} — the Video's
 * {@link PreviewAudioDriver} schedules it on the shared Web Audio context.
 */
export class MediabunnyVideoSource implements VideoSource, SchedulableAudioSource {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _ctx: CanvasRenderingContext2D;
  private _input: Input | null = null;
  private _sink: CanvasSink | null = null;

  // Audio sink off the same Input — null when the file has no decodable audio.
  private _audioSink: AudioBufferSink | null = null;
  private _audioFirstTs = 0;

  private _ready = false;
  private _disposed = false;
  private readonly _readyCbs = new Set<() => void>();
  private readonly _frameCbs = new Set<() => void>();

  private _w = 0;
  private _h = 0;
  private _duration = 0;
  private _firstTs = 0;

  // Forward iterator + a one-frame lookahead so we can land on the last frame
  // whose start timestamp is <= the target without trusting reported durations.
  private _iter: AsyncGenerator<WrappedCanvas, void, unknown> | null = null;
  private _next: WrappedCanvas | null = null;
  private _curTs = Number.NEGATIVE_INFINITY;

  // Seek coalescing: keep at most one decode in flight; rapid scrubbing only ever
  // lands the latest target, so the backlog never grows.
  private _seeking = false;
  private _pending: { time: number; resolvers: Array<() => void> } | null = null;

  constructor() {
    this._canvas = document.createElement("canvas");
    this._canvas.width = 1;
    this._canvas.height = 1;
    const ctx = this._canvas.getContext("2d");
    if (!ctx) throw new Error("[smoove] 2D canvas context unavailable");
    this._ctx = ctx;
  }

  async load(src: string): Promise<void> {
    const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(src) });
    this._input = input;
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(`[smoove] no video track in: ${src}`);
    if (!(await track.canDecode())) {
      throw new Error(`[smoove] cannot decode video track in: ${src}`);
    }
    if (this._disposed) return;

    this._w = await track.getDisplayWidth();
    this._h = await track.getDisplayHeight();
    this._duration = await track.computeDuration();
    this._firstTs = await track.getFirstTimestamp();
    this._canvas.width = this._w;
    this._canvas.height = this._h;
    this._sink = new CanvasSink(track, { poolSize: POOL_SIZE, fit: "fill" });

    // Wire the file's audio track (if any) for the Video's audio driver. A clip
    // with no decodable audio just stays silent — `sink` reports null.
    const audioTrack = await input.getPrimaryAudioTrack();
    if (audioTrack && (await audioTrack.canDecode())) {
      this._audioFirstTs = await audioTrack.getFirstTimestamp();
      this._audioSink = new AudioBufferSink(audioTrack);
    }

    // Decode the first frame so `element` has content the moment we're ready.
    await this._satisfy(this._firstTs);
    if (this._disposed) return;

    this._ready = true;
    for (const cb of this._readyCbs) cb();
  }

  get element(): CanvasImageSource | null {
    return this._ready ? this._canvas : null;
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

  /** @see SchedulableAudioSource — decoded-buffer sink for the file's audio track. */
  get sink(): AudioBufferSink | null {
    return this._audioSink;
  }

  /** @see SchedulableAudioSource — audio track start time in seconds. */
  get firstTimestamp(): number {
    return this._audioFirstTs;
  }

  // mode is ignored: Mediabunny seeks are always frame-accurate and fast enough
  // that scrubbing doesn't need an approximate keyframe-only path.
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
        this._pending.time = clamped; // supersede — only the latest target matters
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

    // Backward seek or a large forward jump: the forward iterator can't help —
    // start a fresh one seeded at the target.
    if (t < this._curTs - SAME_FRAME_EPS || t > this._curTs + BIGGEST_FORWARD_JUMP) {
      await this._restartIterator(t);
    } else if (!this._iter) {
      await this._restartIterator(t);
    }

    // Advance while the lookahead frame still starts at or before the target.
    while (true) {
      if (!this._next) this._next = await this._pull();
      if (this._next && this._next.timestamp <= t + SAME_FRAME_EPS) {
        this._draw(this._next);
        this._next = null;
      } else {
        break;
      }
    }
  }

  private async _restartIterator(t: number): Promise<void> {
    await this._iter?.return();
    this._iter = this._sink?.canvases(Math.max(0, t)) ?? null;
    this._next = null;
    this._curTs = Number.NEGATIVE_INFINITY;
    const first = await this._pull();
    if (first) this._draw(first);
  }

  private async _pull(): Promise<WrappedCanvas | null> {
    if (!this._iter) return null;
    const r = await this._iter.next();
    return r.done ? null : r.value;
  }

  /** Blit a decoded frame onto the owned canvas and notify listeners. */
  private _draw(frame: WrappedCanvas): void {
    this._curTs = frame.timestamp;
    this._ctx.clearRect(0, 0, this._w, this._h);
    this._ctx.drawImage(frame.canvas, 0, 0, this._w, this._h);
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
    this._next = null;
    this._input?.dispose();
    this._input = null;
    this._sink = null;
    this._audioSink = null;
    this._readyCbs.clear();
    this._frameCbs.clear();
    this._pending = null;
  }
}
