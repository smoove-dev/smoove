import type { Timing } from "../types.js";
import { type SpringConfig, measureSpring, spring } from "./spring/index.js";

export type SpringTimingOptions = {
  config?: Partial<SpringConfig>;
  /** Forced length in frames. When omitted, the spring's natural settle time is used. */
  durationInFrames?: number;
  durationRestThreshold?: number;
  reverse?: boolean;
};

/**
 * A transition whose progress follows a physics spring. Mirrors Remotion's
 * `springTiming`. The spring needs an `fps` to integrate — it is taken from the
 * `Composition` via `getProgress`/`getDurationInFrames`.
 */
export function springTiming(options: SpringTimingOptions = {}): Timing {
  const { config, durationInFrames, durationRestThreshold, reverse = false } = options;
  if (
    durationInFrames !== undefined &&
    (!Number.isInteger(durationInFrames) || durationInFrames <= 0)
  ) {
    throw new Error("springTiming: durationInFrames must be a positive integer");
  }
  return {
    getDurationInFrames: (fps) =>
      durationInFrames ??
      Math.ceil(measureSpring({ fps, config, threshold: durationRestThreshold })),
    getProgress: (frame, fps) =>
      spring({
        fps,
        frame,
        config,
        from: reverse ? 1 : 0,
        to: reverse ? 0 : 1,
        durationInFrames,
        durationRestThreshold,
        reverse,
      }),
  };
}
