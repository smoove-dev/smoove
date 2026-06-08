import { type SpringConfig, springCalculation } from "./spring-utils.js";

/**
 * The natural settle time of a spring, in frames: the first frame where the
 * spring is within `threshold` of its target and stays there for 20 frames.
 * Ported from Remotion's `measureSpring`.
 */
export function measureSpring({
  fps,
  config = {},
  threshold = 0.005,
}: {
  fps: number;
  config?: Partial<SpringConfig>;
  threshold?: number;
}): number {
  if (threshold === 0) return Number.POSITIVE_INFINITY;
  if (threshold === 1) return 0;
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new TypeError(`springTiming: durationRestThreshold must be >= 0 (got ${threshold})`);
  }

  const calc = (frame: number) => springCalculation({ fps, frame, config });

  let frame = 0;
  let finished = false;
  let restFrame = 0;
  const cap = 100_000; // safety bound

  while (!finished && frame < cap) {
    const { position } = calc(frame);
    if (Math.abs(position - 1) < threshold) {
      if (restFrame === 0) restFrame = frame;
      if (frame - restFrame >= 20) {
        finished = true;
        break;
      }
    } else {
      restFrame = 0;
    }
    frame++;
  }

  return restFrame;
}
