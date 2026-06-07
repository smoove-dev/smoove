import { parseColor } from "./color.js";
import { interpolate } from "./interpolate.js";

/**
 * Interpolates between a list of colors. API-compatible with Remotion's
 * `interpolateColors`. Returns an `rgba(r, g, b, a)` string. Extrapolation
 * is clamped on both sides.
 */
export const interpolateColors = (
  input: number,
  inputRange: readonly number[],
  outputRange: readonly string[],
): string => {
  if (inputRange.length !== outputRange.length) {
    throw new Error("interpolateColors(): inputRange and outputRange must have the same length");
  }

  const parsed = outputRange.map(parseColor);

  const r = Math.round(
    interpolate(
      input,
      inputRange,
      parsed.map((c) => c.r),
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ),
  );
  const g = Math.round(
    interpolate(
      input,
      inputRange,
      parsed.map((c) => c.g),
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ),
  );
  const b = Math.round(
    interpolate(
      input,
      inputRange,
      parsed.map((c) => c.b),
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ),
  );
  const a = interpolate(
    input,
    inputRange,
    parsed.map((c) => c.a),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
