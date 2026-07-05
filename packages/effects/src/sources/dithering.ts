import { ditheringFragmentShader } from "../glsl/vendor/dithering.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react dithering.tsx).
const SCHEMA: ParamSchema = {
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  colorFront: { type: "color", uniform: "u_colorFront", default: "#00b2ff" },
  shape: {
    type: "enum",
    uniform: "u_shape",
    default: "sphere",
    values: ["simplex", "warp", "dots", "wave", "ripple", "swirl", "sphere"],
    valueMap: { simplex: 1, warp: 2, dots: 3, wave: 4, ripple: 5, swirl: 6, sphere: 7 },
  },
  type: {
    type: "enum",
    uniform: "u_type",
    default: "4x4",
    values: ["random", "2x2", "4x4", "8x8"],
    valueMap: { random: 1, "2x2": 2, "4x4": 3, "8x8": 4 },
  },
  pxSize: { type: "number", uniform: "u_pxSize", default: 2, min: 1, max: 20, step: 1 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type DitheringConfig = ShaderSourceConfig & {
  colorBack?: string;
  colorFront?: string;
  shape?: string;
  type?: string;
  pxSize?: number;
  speed?: number;
};

/** Generative shapes rendered through ordered Bayer or random dithering. */
export class Dithering extends ShaderSource {
  constructor(config: DitheringConfig = {}) {
    super(SCHEMA, ditheringFragmentShader, config);
  }
}

export interface Dithering {
  colorBack(): string;
  colorBack(v: string): this;
  colorFront(): string;
  colorFront(v: string): this;
  shape(): string;
  shape(v: string): this;
  type(): string;
  type(v: string): this;
  pxSize(): number;
  pxSize(v: number): this;
  speed(): number;
  speed(v: number): this;
}
