import { meshGradientFragmentShader } from "../glsl/vendor/mesh-gradient.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react mesh-gradient.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#e0eaff", "#241d9a", "#f75092", "#9f50d3"],
    max: 10,
  },
  distortion: { type: "number", uniform: "u_distortion", default: 0.8, min: 0, max: 1, step: 0.01 },
  swirl: { type: "number", uniform: "u_swirl", default: 0.1, min: 0, max: 1, step: 0.01 },
  grainMixer: { type: "number", uniform: "u_grainMixer", default: 0, min: 0, max: 1, step: 0.01 },
  grainOverlay: {
    type: "number",
    uniform: "u_grainOverlay",
    default: 0,
    min: 0,
    max: 1,
    step: 0.01,
  },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type MeshGradientConfig = ShaderSourceConfig & {
  colors?: string[];
  distortion?: number;
  swirl?: number;
  grainMixer?: number;
  grainOverlay?: number;
  speed?: number;
};

export class MeshGradient extends ShaderSource {
  constructor(config: MeshGradientConfig = {}) {
    super(SCHEMA, meshGradientFragmentShader, config);
  }
}

export interface MeshGradient {
  colors(): string[];
  colors(v: string[]): this;
  distortion(): number;
  distortion(v: number): this;
  swirl(): number;
  swirl(v: number): this;
  grainMixer(): number;
  grainMixer(v: number): this;
  grainOverlay(): number;
  grainOverlay(v: number): this;
  speed(): number;
  speed(v: number): this;
}
