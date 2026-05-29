import type { Composition } from "../composition.js";
import type { VideoSource } from "./video-source.js";

/** Resolved per-video timing, derived from VideoConfig + composition fps. */
export type VideoTiming = {
  fps: number;
  /** Frames trimmed from the start of the media. */
  trimBefore: number;
  /** Exclusive frame bound, or undefined to play to the media's natural end. */
  trimAfter?: number;
  loop: boolean;
  playbackRate: number;
};

/**
 * What a driver needs from the host {@link Video}: the media source, the
 * resolved timing, the owning composition (for the render gate + play state),
 * and a redraw hook (relayout + batchDraw).
 */
export type VideoDriverContext = {
  readonly source: VideoSource;
  readonly timing: VideoTiming;
  readonly comp: Composition;
  redraw(): void;
};

/**
 * Strategy that maps the composition's current frame onto the media. Mirrors
 * Remotion's split between `VideoForRendering` and `VideoForPreview`.
 */
export interface VideoDriver {
  /** Called by Sequence each tick while the video is on-stage (`localFrame` = frame - sequence.from). */
  tick(localFrame: number): void;
  /** Called by Sequence when the video leaves range. */
  deactivate(): void;
  /** Release any subscriptions; called on `Video.destroy()`. */
  dispose(): void;
}

/**
 * Convert a local frame to a media time in seconds — Remotion's `getMediaTime`,
 * extended with `loop` wrap-around. Without `loop`, the media freezes on its
 * last in-range frame (Remotion's default behavior).
 */
export function getMediaTime(localFrame: number, timing: VideoTiming): number {
  const { fps, trimBefore, trimAfter, loop, playbackRate } = timing;
  const advanced = localFrame * playbackRate;
  if (trimAfter === undefined) {
    // No explicit end bound: play forward; loop has no length to wrap to.
    return (trimBefore + advanced) / fps;
  }
  const loopLen = Math.max(1, trimAfter - trimBefore);
  const eff = loop ? ((advanced % loopLen) + loopLen) % loopLen : Math.min(advanced, loopLen - 1);
  return (trimBefore + eff) / fps;
}
