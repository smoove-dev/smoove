import { smokeRingFragmentShader } from "../glsl/vendor/smoke-ring.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react smoke-ring.tsx).
const SCHEMA: ParamSchema = {
  colors: { type: "colors", uniform: "u_colors", default: ["#ffffff"], max: 10 },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  noiseScale: {
    type: "number",
    uniform: "u_noiseScale",
    default: 3,
    min: 0.01,
    max: 5,
    step: 0.01,
  },
  noiseIterations: {
    type: "number",
    uniform: "u_noiseIterations",
    default: 8,
    min: 1,
    max: 8,
    step: 1,
  },
  radius: { type: "number", uniform: "u_radius", default: 0.25, min: 0, max: 1, step: 0.01 },
  thickness: {
    type: "number",
    uniform: "u_thickness",
    default: 0.65,
    min: 0.1,
    max: 1,
    step: 0.01,
  },
  innerShape: { type: "number", uniform: "u_innerShape", default: 0.7, min: 0, max: 4, step: 0.01 },
  speed: { type: "number", uniform: null, default: 0.5, min: -5, max: 5, step: 0.1 },
};

export type SmokeRingConfig = ShaderSourceConfig & {
  colors?: string[];
  colorBack?: string;
  noiseScale?: number;
  noiseIterations?: number;
  radius?: number;
  thickness?: number;
  innerShape?: number;
  speed?: number;
};

/** Fractal-noise smoke ring radiating from the center. */
export class SmokeRing extends ShaderSource {
  constructor(config: SmokeRingConfig = {}) {
    super(SCHEMA, smokeRingFragmentShader, config);
  }
}

export interface SmokeRing {
  colors(): string[];
  colors(v: string[]): this;
  colorBack(): string;
  colorBack(v: string): this;
  noiseScale(): number;
  noiseScale(v: number): this;
  noiseIterations(): number;
  noiseIterations(v: number): this;
  radius(): number;
  radius(v: number): this;
  thickness(): number;
  thickness(v: number): this;
  innerShape(): number;
  innerShape(v: number): this;
  speed(): number;
  speed(v: number): this;
}
