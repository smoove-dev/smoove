import { liquidMetalFragmentShader } from "../glsl/vendor/liquid-metal.js";
import { ImageShaderSource, type ImageShaderSourceConfig } from "../image-source.js";
import type { ParamSchema } from "../params.js";
import { computeEdgeField } from "../processing/edge-field.js";

// Defaults mirror upstream's Default preset (shaders-react liquid-metal.tsx).
const SCHEMA: ParamSchema = {
  colorBack: { type: "color", uniform: "u_colorBack", default: "#AAAAAC" },
  colorTint: { type: "color", uniform: "u_colorTint", default: "#ffffff" },
  repetition: { type: "number", uniform: "u_repetition", default: 2, min: 1, max: 10, step: 0.1 },
  softness: { type: "number", uniform: "u_softness", default: 0.1, min: 0, max: 1, step: 0.01 },
  shiftRed: { type: "number", uniform: "u_shiftRed", default: 0.3, min: -1, max: 1, step: 0.01 },
  shiftBlue: { type: "number", uniform: "u_shiftBlue", default: 0.3, min: -1, max: 1, step: 0.01 },
  distortion: {
    type: "number",
    uniform: "u_distortion",
    default: 0.07,
    min: 0,
    max: 1,
    step: 0.01,
  },
  contour: { type: "number", uniform: "u_contour", default: 0.4, min: 0, max: 1, step: 0.01 },
  angle: { type: "number", uniform: "u_angle", default: 70, min: 0, max: 360, step: 1 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type LiquidMetalConfig = ImageShaderSourceConfig & {
  colorBack?: string;
  colorTint?: string;
  repetition?: number;
  softness?: number;
  shiftRed?: number;
  shiftBlue?: number;
  distortion?: number;
  contour?: number;
  angle?: number;
  speed?: number;
};

/**
 * The paper-design liquid-metal logo animation: chrome stripes flowing
 * through a source image (its `src`), driven by a pre-processed Poisson edge
 * field.
 */
export class LiquidMetal extends ImageShaderSource {
  constructor(config: LiquidMetalConfig) {
    super(SCHEMA, liquidMetalFragmentShader, (img) => computeEdgeField(img, 0), config);
  }
}

export interface LiquidMetal {
  colorBack(): string;
  colorBack(v: string): this;
  colorTint(): string;
  colorTint(v: string): this;
  repetition(): number;
  repetition(v: number): this;
  softness(): number;
  softness(v: number): this;
  shiftRed(): number;
  shiftRed(v: number): this;
  shiftBlue(): number;
  shiftBlue(v: number): this;
  distortion(): number;
  distortion(v: number): this;
  contour(): number;
  contour(v: number): this;
  angle(): number;
  angle(v: number): this;
  speed(): number;
  speed(v: number): this;
}
