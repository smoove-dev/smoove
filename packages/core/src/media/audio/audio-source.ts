import type { Environment } from "../environment.js";
import type { SeekMode } from "../video/video-source.js";

export type { SeekMode };

/**
 * Runtime-agnostic audio source — the dependency-injection seam between the
 * engine and the actual media decoder. The browser implementation
 * ({@link BrowserAudioSource}) wraps an `HTMLAudioElement`. Mirrors
 * {@link VideoSource} minus the drawable/dimension members (audio has no pixels).
 */
export interface AudioSource {
  load(src: string): Promise<void>;
  /** Duration in seconds, or 0 if unknown. */
  readonly duration: number;
  /** Current media playback position in seconds. */
  readonly currentTime: number;
  readonly isReady: boolean;
  /**
   * Seek to a time in seconds. `mode: "fast"` requests an approximate, snappy
   * seek (nearest keyframe) for scrubbing; the default `"precise"` lands on the
   * exact time.
   */
  seek(timeSeconds: number, mode?: SeekMode): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  /** Fires once when metadata is available. */
  onReady(cb: () => void): () => void;
  destroy(): void;
}

/**
 * Factory for an {@link AudioSource}. Receives the resolved {@link Environment}
 * so a single factory can pick an implementation based on whether we are
 * rendering or previewing.
 */
export type AudioSourceFactory = (env: Environment) => AudioSource;
