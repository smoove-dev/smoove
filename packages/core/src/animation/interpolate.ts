export type ExtrapolateType = "extend" | "identity" | "clamp" | "wrap";

export type InterpolateOptions = {
  easing?: (input: number) => number;
  extrapolateLeft?: ExtrapolateType;
  extrapolateRight?: ExtrapolateType;
};

const findRange = (input: number, inputRange: readonly number[]): number => {
  let i = 1;
  for (; i < inputRange.length - 1; i++) {
    if ((inputRange[i] as number) >= input) break;
  }
  return i - 1;
};

const interpolateSegment = (
  input: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number,
  easing: (n: number) => number,
  extrapolateLeft: ExtrapolateType,
  extrapolateRight: ExtrapolateType,
): number => {
  let result = input;

  if (result < inputMin) {
    if (extrapolateLeft === "identity") return result;
    if (extrapolateLeft === "clamp") result = inputMin;
    else if (extrapolateLeft === "wrap") {
      const range = inputMax - inputMin;
      result = ((((result - inputMin) % range) + range) % range) + inputMin;
    }
  }

  if (result > inputMax) {
    if (extrapolateRight === "identity") return result;
    if (extrapolateRight === "clamp") result = inputMax;
    else if (extrapolateRight === "wrap") {
      const range = inputMax - inputMin;
      result = ((((result - inputMin) % range) + range) % range) + inputMin;
    }
  }

  if (outputMin === outputMax) return outputMin;

  // Normalize and ease.
  let t = (result - inputMin) / (inputMax - inputMin);
  t = easing(t);
  return outputMin + t * (outputMax - outputMin);
};

/**
 * Maps `input` from `inputRange` onto `outputRange`. API-compatible with
 * Remotion's `interpolate`.
 */
export const interpolate = (
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options?: InterpolateOptions,
): number => {
  if (typeof input !== "number") {
    throw new TypeError("interpolate(): input must be a number");
  }
  if (inputRange.length < 2 || outputRange.length < 2) {
    throw new Error("interpolate(): inputRange and outputRange must have at least 2 elements");
  }
  if (inputRange.length !== outputRange.length) {
    throw new Error("interpolate(): inputRange and outputRange must have the same length");
  }
  for (let i = 1; i < inputRange.length; i++) {
    if (!((inputRange[i] as number) > (inputRange[i - 1] as number))) {
      throw new Error("interpolate(): inputRange must be strictly monotonically increasing");
    }
  }

  if (Number.isNaN(input)) return input;

  const easing = options?.easing ?? ((n: number) => n);
  const extrapolateLeft = options?.extrapolateLeft ?? "extend";
  const extrapolateRight = options?.extrapolateRight ?? "extend";

  const i = findRange(input, inputRange);
  return interpolateSegment(
    input,
    inputRange[i] as number,
    inputRange[i + 1] as number,
    outputRange[i] as number,
    outputRange[i + 1] as number,
    easing,
    extrapolateLeft,
    extrapolateRight,
  );
};
