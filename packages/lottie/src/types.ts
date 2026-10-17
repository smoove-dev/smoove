import type { FlexChildProps, ObjectFit, ObjectPosition, SizeInput } from "@smoove/core";
import type Konva from "konva";
import type { LottieEngineFactory } from "./engine.js";

/** Animation payload accepted inline: parsed JSON, a JSON string, or `.lottie` bytes. */
export type LottieData = string | ArrayBuffer | Record<string, unknown>;

/**
 * Config for {@link Lottie}. Sizing, fit and trim props are spelled exactly as
 * `Image`/`Video` spell them; `speed`, `marker` and `segment` are the
 * Lottie-specific additions.
 */
export type LottieConfig = Omit<Konva.ShapeConfig, "width" | "height"> &
  FlexChildProps & {
    width?: SizeInput;
    height?: SizeInput;
    /** URL of a `.json` or `.lottie` animation. Mutually exclusive with {@link data}. */
    src?: string;
    /** Inline animation payload. Mutually exclusive with {@link src}. */
    data?: LottieData;
    /** How the animation scales into the node's box. Default `"contain"`. */
    objectFit?: ObjectFit;
    /** Where it sits when it doesn't fill the box. Default `"center"`. */
    objectPosition?: ObjectPosition;
    cornerRadius?: number | number[];
    /** Frames trimmed from the start of the animation (composition fps). */
    trimBefore?: number;
    /** Exclusive frame bound (composition fps). Defaults to the animation's own length. */
    trimAfter?: number;
    /** Repeat within the sequence window instead of freezing on the last frame. */
    loop?: boolean;
    /** Playback rate against composition time. Default `1`. */
    speed?: number;
    /** Play only this named Lottie marker's range. */
    marker?: string;
    /** Explicit Lottie-frame range `[start, end)`. Overrides {@link marker}. */
    segment?: [number, number];
    /**
     * Rasterization scale. Defaults to the stage's pixel ratio, clamped to 3.
     * Lower it to trade sharpness for speed on large animations.
     */
    pixelRatio?: number;
    /** Inject an alternative engine. Defaults to the dotlottie-web engine. */
    engineFactory?: LottieEngineFactory;
  };
