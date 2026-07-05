import { simplexNoiseFragmentShader } from "../glsl/vendor/simplex-noise.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react simplex-noise.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#4449CF", "#FFD1E0", "#F94446", "#FFD36B", "#FFFFFF"],
    max: 10,
  },
  stepsPerColor: {
    type: "number",
    uniform: "u_stepsPerColor",
    default: 2,
    min: 1,
    max: 10,
    step: 1,
  },
  softness: { type: "number", uniform: "u_softness", default: 0, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 0.5, min: -5, max: 5, step: 0.1 },
};

export type SimplexNoiseConfig = ShaderSourceConfig & {
  colors?: string[];
  stepsPerColor?: number;
  softness?: number;
  speed?: number;
};

/** Multi-color gradient mapped into animated simplex-noise curves. */
export class SimplexNoise extends ShaderSource {
  constructor(config: SimplexNoiseConfig = {}) {
    super(SCHEMA, simplexNoiseFragmentShader, config);
  }
}

export interface SimplexNoise {
  colors(): string[];
  colors(v: string[]): this;
  stepsPerColor(): number;
  stepsPerColor(v: number): this;
  softness(): number;
  softness(v: number): this;
  speed(): number;
  speed(v: number): this;
}
