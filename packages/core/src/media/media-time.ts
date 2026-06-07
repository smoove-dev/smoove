/** Resolved per-clip timing, derived from a media config + composition fps. */
export type MediaTiming = {
  fps: number;
  /** Frames trimmed from the start of the media. */
  trimBefore: number;
  /** Exclusive frame bound, or undefined to play to the media's natural end. */
  trimAfter?: number;
  loop: boolean;
  playbackRate: number;
};

/**
 * Convert a local frame to a media time in seconds — Remotion's `getMediaTime`,
 * extended with `loop` wrap-around. Without `loop`, the media freezes on its
 * last in-range frame (Remotion's default behavior). Shared by video and audio.
 */
export function getMediaTime(localFrame: number, timing: MediaTiming): number {
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
