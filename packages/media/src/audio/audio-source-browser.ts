import type { AudioSource, SeekMode } from "@smoove/core";

type FastSeekAudio = HTMLAudioElement & {
  fastSeek?: (time: number) => void;
};

/**
 * Preview-mode {@link AudioSource}: wraps an `HTMLAudioElement` and drives it in
 * realtime. Ported from {@link BrowserVideoSource} minus the drawable/rvfc bits
 * (audio produces no frames). A server renderer injects a different source via
 * `AudioConfig.sourceFactory`.
 */
export class BrowserAudioSource implements AudioSource {
  private readonly _el: FastSeekAudio;
  private _ready = false;
  private readonly _readyCbs = new Set<() => void>();

  // Seek coalescing: keep at most one seek in flight. Rapid scrubbing only ever
  // lands the latest target — intermediate ones are dropped — so the backlog
  // never grows (which is what makes scrubbing a large clip degrade over time).
  private _seeking = false;
  private _pending: { time: number; mode: SeekMode; resolvers: Array<() => void> } | null = null;

  constructor() {
    // createElement (not `new Audio()`) dodges the global `Audio` constructor,
    // which collides with our exported `Audio` class.
    const el = document.createElement("audio") as FastSeekAudio;
    el.crossOrigin = "anonymous";
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
        for (const cb of this._readyCbs) cb();
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new Error(`Failed to load audio: ${src}`));
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

  destroy(): void {
    this._el.pause();
    this._el.removeAttribute("src");
    this._el.load();
    this._readyCbs.clear();
    this._pending = null;
    this._seeking = false;
  }
}
