import { interpolate } from "@smoove/core";
import { measureSpring } from "./measure-spring.js";
import { type SpringConfig, springCalculation } from "./spring-utils.js";

export { measureSpring } from "./measure-spring.js";
export { defaultSpringConfig, type SpringConfig } from "./spring-utils.js";

/**
 * Sample a physics spring at `frame`. Returns a value animating `from → to`.
 * Ported from Remotion's `spring()`. When `durationInFrames` or `reverse` is
 * set, time is remapped against the spring's natural settle time.
 */
export function spring({
  frame,
  fps,
  config = {},
  from = 0,
  to = 1,
  durationInFrames,
  durationRestThreshold,
  reverse = false,
}: {
  frame: number;
  fps: number;
  config?: Partial<SpringConfig>;
  from?: number;
  to?: number;
  durationInFrames?: number;
  durationRestThreshold?: number;
  reverse?: boolean;
}): number {
  const needsNatural = reverse || durationInFrames !== undefined;
  const naturalDuration = needsNatural
    ? measureSpring({ fps, config, threshold: durationRestThreshold })
    : undefined;

  let frameToUse = frame;
  if (reverse) {
    const duration = durationInFrames ?? (naturalDuration as number);
    frameToUse = duration - frame;
  }

  if (durationInFrames !== undefined && naturalDuration !== undefined && naturalDuration !== 0) {
    const stretch = durationInFrames / naturalDuration;
    frameToUse = frameToUse / stretch;
  }

  const { position } = springCalculation({ fps, frame: frameToUse, config });

  if (from === 0 && to === 1) return position;
  return interpolate(position, [0, 1], [from, to]);
}
