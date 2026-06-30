import type { Composition } from "@smoove/core";
import type { ReadonlySignal } from "./signal.js";

/**
 * The reactive state a `<km-player>` exposes to its descendant control
 * components. These are **stable** signals owned by the player — they survive
 * the `Composition` being swapped, so a control subscribes once on connect.
 * Composition-derived values mirror the live comp; `fullscreen` and `scale`
 * are player-owned (not part of core).
 */
export interface PlayerState {
  readonly frame: ReadonlySignal<number>;
  readonly playing: ReadonlySignal<boolean>;
  readonly duration: ReadonlySignal<number>;
  readonly loop: ReadonlySignal<boolean>;
  readonly rate: ReadonlySignal<number>;
  readonly volume: ReadonlySignal<number>;
  readonly muted: ReadonlySignal<boolean>;
  readonly fullscreen: ReadonlySignal<boolean>;
  readonly scale: ReadonlySignal<number>;
}

/**
 * The control surface a `<km-player>` provides to its descendants and to
 * imperative consumers. `<km-player>` itself implements this interface, so
 * `el.closest("km-player")` (or the `playerContext`) yields a `PlayerApi`.
 * Method names mirror Remotion's `PlayerRef`.
 */
export interface PlayerApi {
  /** The mounted composition, or `null` before one is assigned. */
  readonly composition: Composition | null;
  /** The composition's frame rate (0 until a composition is mounted). */
  readonly fps: number;
  /** Stable reactive state for descendant controls to subscribe to. */
  readonly state: PlayerState;

  play(): void;
  pause(): void;
  toggle(): void;
  stop(): void;
  seekTo(frame: number): void;
  /** Step the playhead by `delta` frames (negative steps backward). */
  stepBy(delta: number): void;
  getCurrentFrame(): number;
  isPlaying(): boolean;
  /** Push new props onto the mounted composition; it re-renders the current
      frame automatically. No-op before a composition is assigned. */
  setProps(props: Record<string, unknown>): void;

  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unmute(): void;
  setMuted(muted: boolean): void;
  toggleMute(): void;
  isMuted(): boolean;

  setLoop(loop: boolean): void;
  toggleLoop(): void;
  isLooping(): boolean;

  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;

  requestFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  toggleFullscreen(): void;
  isFullscreen(): boolean;
  getScale(): number;
}
