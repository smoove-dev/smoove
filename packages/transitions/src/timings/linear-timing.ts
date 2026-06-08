import { interpolate } from "@konva-motion/core";
import type { Timing } from "../types.js";

export type LinearTimingOptions = {
  durationInFrames: number;
  /** Optional easing curve from core's `Easing` (e.g. `Easing.inOut(Easing.cubic)`). */
  easing?: (input: number) => number;
};

/**
 * A transition whose progress moves linearly (optionally eased) from 0 to 1
 * over `durationInFrames`. Mirrors Remotion's `linearTiming`.
 */
export function linearTiming(options: LinearTimingOptions): Timing {
  const { durationInFrames, easing } = options;
  if (!Number.isInteger(durationInFrames) || durationInFrames <= 0) {
    throw new Error("linearTiming: durationInFrames must be a positive integer");
  }
  return {
    getDurationInFrames: () => durationInFrames,
    getProgress: (frame) =>
      interpolate(frame, [0, durationInFrames], [0, 1], {
        easing,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
  };
}
