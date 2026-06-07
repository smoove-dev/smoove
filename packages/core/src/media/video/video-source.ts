import type { Environment } from "../environment.js";

/** Seek precision: exact frame ("precise", default) vs. snappy nearest-keyframe ("fast", for scrubbing). */
export type SeekMode = "precise" | "fast";

/**
 * Runtime-agnostic video source — the dependency-injection seam between the
 * engine and the actual media decoder. The browser implementation
 * ({@link BrowserVideoSource}) wraps an `HTMLVideoElement`; a server renderer
 * (e.g. Bun + Skia Canvas) injects its own decoder-backed source that produces
 * drawable frames on demand.
 */
export interface VideoSource {
  load(src: string): Promise<void>;
  /** Drawable surface for `Konva.Image`, or null until ready. */
  readonly element: CanvasImageSource | null;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  /** Duration in seconds, or 0 if unknown. */
  readonly duration: number;
  /** Current media playback position in seconds. */
  readonly currentTime: number;
  readonly isReady: boolean;
  /**
   * Seek to a time in seconds. Resolves once the frame at that time has been
   * decoded and is ready to draw — rendering `await`s this to gate frame
   * capture; preview fires it and forgets.
   *
   * `mode: "fast"` requests an approximate, snappy seek (nearest keyframe) for
   * scrubbing; the default `"precise"` lands on the exact frame.
   */
  seek(timeSeconds: number, mode?: SeekMode): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  /** Fires once when metadata + first frame are available. */
  onReady(cb: () => void): () => void;
  /** Fires whenever a new frame has been decoded and is ready to draw. */
  onFrame(cb: () => void): () => void;
  destroy(): void;
}

/**
 * Factory for a {@link VideoSource}. Receives the resolved {@link Environment}
 * so a single factory can pick an implementation (e.g. browser vs. decoder)
 * based on whether we are rendering or previewing.
 */
export type VideoSourceFactory = (env: Environment) => VideoSource;
