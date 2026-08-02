import { getMediaTime } from "@smoove/core";

/**
 * Everything needed to place a composition frame onto a Lottie animation.
 * Frame counts in `trimBefore`/`trimAfter` are **composition** frames (as in
 * `Video`); `segment` and the return value are **Lottie** frames.
 */
export type LottieTiming = {
  /** The composition's frame rate — the clock `localFrame` is expressed in. */
  fps: number;
  /** The animation's own frame rate. */
  lottieFps: number;
  /** The animation's total frame count. */
  totalFrames: number;
  /** Composition frames trimmed off the start. */
  trimBefore: number;
  /** Exclusive composition-frame bound. Defaults to the playable length. */
  trimAfter?: number;
  /** Wrap instead of freezing on the last frame. */
  loop: boolean;
  /** Playback rate against composition time. */
  speed: number;
  /** Lottie-frame range `[start, end)` to play. Defaults to the whole animation. */
  segment?: readonly [number, number];
};

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** The animation's playable length expressed in composition frames. */
export function naturalDurationInFrames(timing: LottieTiming): number {
  const { fps, lottieFps } = timing;
  if (fps <= 0 || lottieFps <= 0) return 0;
  const [start, end] = resolveSegment(timing);
  return Math.max(1, Math.round(((end - start) / lottieFps) * fps));
}

/** The playable Lottie-frame range, clamped into the animation and ordered. */
export function resolveSegment(timing: LottieTiming): [number, number] {
  const total = Math.max(0, timing.totalFrames);
  const [rawStart, rawEnd] = timing.segment ?? [0, total];
  const start = clamp(rawStart, 0, total);
  const end = clamp(rawEnd, start, total);
  return [start, end];
}

/**
 * Map a timeline-local composition frame onto a (possibly fractional) Lottie
 * frame. Delegates trims and loop wrap-around to core's `getMediaTime`, the
 * same helper `Video` and `Audio` use, so all three behave identically.
 */
export function lottieFrameAt(localFrame: number, timing: LottieTiming): number {
  const [start, end] = resolveSegment(timing);
  if (timing.fps <= 0 || timing.lottieFps <= 0) return start;

  const seconds = getMediaTime(localFrame, {
    fps: timing.fps,
    trimBefore: timing.trimBefore,
    trimAfter: timing.trimAfter ?? timing.trimBefore + naturalDurationInFrames(timing),
    loop: timing.loop,
    playbackRate: timing.speed,
  });

  // `seconds` counts from the animation's start, so the segment offset is added
  // on top. The last renderable frame is `end - 1`.
  return clamp(start + seconds * timing.lottieFps, start, Math.max(start, end - 1));
}
