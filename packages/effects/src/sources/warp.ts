import { warpFragmentShader } from "../glsl/vendor/warp.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react warp.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#121212", "#9470ff", "#121212", "#8838ff"],
    max: 10,
  },
  proportion: {
    type: "number",
    uniform: "u_proportion",
    default: 0.45,
    min: 0,
    max: 1,
    step: 0.01,
  },
  softness: { type: "number", uniform: "u_softness", default: 1, min: 0, max: 1, step: 0.01 },
  distortion: {
    type: "number",
    uniform: "u_distortion",
    default: 0.25,
    min: 0,
    max: 1,
    step: 0.01,
  },
  swirl: { type: "number", uniform: "u_swirl", default: 0.8, min: 0, max: 1, step: 0.01 },
  swirlIterations: {
    type: "number",
    uniform: "u_swirlIterations",
    default: 10,
    min: 0,
    max: 20,
    step: 1,
  },
  shapeScale: { type: "number", uniform: "u_shapeScale", default: 0.1, min: 0, max: 1, step: 0.01 },
  shape: {
    type: "enum",
    uniform: "u_shape",
    default: "checks",
    values: ["checks", "stripes", "edge"],
    valueMap: { checks: 0, stripes: 1, edge: 2 },
  },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type WarpConfig = ShaderSourceConfig & {
  colors?: string[];
  proportion?: number;
  softness?: number;
  distortion?: number;
  swirl?: number;
  swirlIterations?: number;
  shapeScale?: number;
  shape?: string;
  speed?: number;
};

/** Swirling warp distortion over checks, stripes or color edges. */
export class Warp extends ShaderSource {
  constructor(config: WarpConfig = {}) {
    super(SCHEMA, warpFragmentShader, config);
  }
}

export interface Warp {
  colors(): string[];
  colors(v: string[]): this;
  proportion(): number;
  proportion(v: number): this;
  softness(): number;
  softness(v: number): this;
  distortion(): number;
  distortion(v: number): this;
  swirl(): number;
  swirl(v: number): this;
  swirlIterations(): number;
  swirlIterations(v: number): this;
  shapeScale(): number;
  shapeScale(v: number): this;
  shape(): string;
  shape(v: string): this;
  speed(): number;
  speed(v: number): this;
}
