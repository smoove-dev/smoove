import { staticMeshGradientFragmentShader } from "../glsl/vendor/static-mesh-gradient.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react static-mesh-gradient.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#ffad0a", "#6200ff", "#e2a3ff", "#ff99fd"],
    max: 10,
  },
  positions: { type: "number", uniform: "u_positions", default: 2, min: 0, max: 33, step: 1 },
  waveX: { type: "number", uniform: "u_waveX", default: 1, min: 0, max: 1, step: 0.01 },
  waveXShift: { type: "number", uniform: "u_waveXShift", default: 0.6, min: 0, max: 1, step: 0.01 },
  waveY: { type: "number", uniform: "u_waveY", default: 1, min: 0, max: 1, step: 0.01 },
  waveYShift: {
    type: "number",
    uniform: "u_waveYShift",
    default: 0.21,
    min: 0,
    max: 1,
    step: 0.01,
  },
  mixing: { type: "number", uniform: "u_mixing", default: 0.93, min: 0, max: 1, step: 0.01 },
  grainMixer: { type: "number", uniform: "u_grainMixer", default: 0, min: 0, max: 1, step: 0.01 },
  grainOverlay: {
    type: "number",
    uniform: "u_grainOverlay",
    default: 0,
    min: 0,
    max: 1,
    step: 0.01,
  },
};

export type StaticMeshGradientConfig = ShaderSourceConfig & {
  colors?: string[];
  positions?: number;
  waveX?: number;
  waveXShift?: number;
  waveY?: number;
  waveYShift?: number;
  mixing?: number;
  grainMixer?: number;
  grainOverlay?: number;
};

/** Still mesh gradient built from wave-placed color spots. */
export class StaticMeshGradient extends ShaderSource {
  constructor(config: StaticMeshGradientConfig = {}) {
    super(SCHEMA, staticMeshGradientFragmentShader, config);
  }
}

export interface StaticMeshGradient {
  colors(): string[];
  colors(v: string[]): this;
  positions(): number;
  positions(v: number): this;
  waveX(): number;
  waveX(v: number): this;
  waveXShift(): number;
  waveXShift(v: number): this;
  waveY(): number;
  waveY(v: number): this;
  waveYShift(): number;
  waveYShift(v: number): this;
  mixing(): number;
  mixing(v: number): this;
  grainMixer(): number;
  grainMixer(v: number): this;
  grainOverlay(): number;
  grainOverlay(v: number): this;
}
