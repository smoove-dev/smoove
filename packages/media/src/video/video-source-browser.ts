import type { SeekMode, VideoSource } from "@smoove/core";

type RvfcVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
  fastSeek?: (time: number) => void;
};

/**
 * Preview-mode {@link VideoSource}: wraps an `HTMLVideoElement` and drives it in
 * realtime. The server renderer injects a different source via
 * `VideoConfig.sourceFactory`.
 */
export class BrowserVideoSource implements VideoSource {
  private readonly _el: RvfcVideo;
  private _ready = false;
  private readonly _readyCbs = new Set<() => void>();
  private readonly _frameCbs = new Set<() => void>();
  private _rvfcId: number | null = null;
  private _rvfcRunning = false;

  // Seek coalescing: keep at most one seek in flight. Rapid scrubbing only ever
  // lands the latest target — intermediate ones are dropped — so the backlog
  // never grows (which is what makes scrubbing a large clip degrade over time).
  private _seeking = false;
  private _pending: { time: number; mode: SeekMode; resolvers: Array<() => void> } | null = null;

  constructor() {
    const el = document.createElement("video") as RvfcVideo;
    el.crossOrigin = "anonymous";
    el.playsInline = true;
    el.preload = "auto";
    // Muted so the browser allows programmatic play()/seek before any user gesture.
    el.muted = true;
    this._el = el;
  }

  load(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const onReady = () => {
        cleanup();
        this._ready = true;
        this._startFrameLoop();
        for (const cb of this._readyCbs) cb();
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new Error(`Failed to load video: ${src}`));
      };
      const cleanup = () => {
        this._el.removeEventListener("loadeddata", onReady);
        this._el.removeEventListener("error", onErr);
      };
      this._el.addEventListener("loadeddata", onReady);
      this._el.addEventListener("error", onErr);
      this._el.src = src;
    });
  }

  private _startFrameLoop(): void {
    if (this._rvfcRunning) return;
    if (typeof this._el.requestVideoFrameCallback !== "function") return;
    this._rvfcRunning = true;
    const tick = () => {
      for (const cb of this._frameCbs) cb();
      this._rvfcId = this._el.requestVideoFrameCallback?.(tick) ?? null;
    };
    this._rvfcId = this._el.requestVideoFrameCallback(tick);
  }

  get element(): CanvasImageSource | null {
    return this._ready ? this._el : null;
  }

  get naturalWidth(): number {
    return this._el.videoWidth;
  }

  get naturalHeight(): number {
    return this._el.videoHeight;
  }

  get duration(): number {
    return Number.isFinite(this._el.duration) ? this._el.duration : 0;
  }

  get currentTime(): number {
    return this._el.currentTime;
  }

  get isReady(): boolean {
    return this._ready;
  }

  seek(timeSeconds: number, mode: SeekMode = "precise"): Promise<void> {
    const clamped = Math.max(
      0,
      this.duration > 0 ? Math.min(this.duration, timeSeconds) : timeSeconds,
    );
    // No-op seek with nothing in flight: already there, resolve immediately.
    if (!this._seeking && Math.abs(this._el.currentTime - clamped) <= 1e-4) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      if (this._pending) {
        // Supersede the queued target — only the latest scrub position matters.
        this._pending.time = clamped;
        this._pending.mode = mode;
        this._pending.resolvers.push(resolve);
      } else {
        this._pending = { time: clamped, mode, resolvers: [resolve] };
      }
      this._drainSeek();
    });
  }

  /** Issue the pending seek if none is in flight; chains the latest target after each completes. */
  private _drainSeek(): void {
    if (this._seeking || !this._pending) return;
    const { time, mode, resolvers } = this._pending;
    this._pending = null;

    if (Math.abs(this._el.currentTime - time) <= 1e-4) {
      for (const r of resolvers) r();
      this._drainSeek();
      return;
    }

    this._seeking = true;
    const onSeeked = () => {
      this._el.removeEventListener("seeked", onSeeked);
      this._seeking = false;
      for (const r of resolvers) r();
      // A newer target may have arrived mid-seek — land it now.
      this._drainSeek();
    };
    this._el.addEventListener("seeked", onSeeked);
    // fastSeek jumps to the nearest keyframe — much snappier for scrubbing a
    // large clip. Fall back to a precise currentTime seek when unavailable.
    if (mode === "fast" && typeof this._el.fastSeek === "function") {
      this._el.fastSeek(time);
    } else {
      this._el.currentTime = time;
    }
  }

  play(): Promise<void> {
    return this._el.play();
  }

  pause(): void {
    this._el.pause();
  }

  setMuted(muted: boolean): void {
    this._el.muted = muted;
  }

  setVolume(volume: number): void {
    this._el.volume = Math.max(0, Math.min(1, volume));
  }

  setPlaybackRate(rate: number): void {
    this._el.playbackRate = rate;
  }

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
    if (this._rvfcId !== null && typeof this._el.cancelVideoFrameCallback === "function") {
      this._el.cancelVideoFrameCallback(this._rvfcId);
    }
    this._el.pause();
    this._el.removeAttribute("src");
    this._el.load();
    this._readyCbs.clear();
    this._frameCbs.clear();
    this._pending = null;
    this._seeking = false;
  }
}
