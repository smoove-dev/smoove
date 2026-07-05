import { pulsingBorderFragmentShader } from "../glsl/vendor/pulsing-border.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react pulsing-border.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#0dc1fd", "#d915ef", "#ff3f2ecc"],
    max: 5,
  },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  roundness: { type: "number", uniform: "u_roundness", default: 0.25, min: 0, max: 1, step: 0.01 },
  thickness: { type: "number", uniform: "u_thickness", default: 0.1, min: 0, max: 1, step: 0.01 },
  softness: { type: "number", uniform: "u_softness", default: 0.75, min: 0, max: 1, step: 0.01 },
  intensity: { type: "number", uniform: "u_intensity", default: 0.2, min: 0, max: 1, step: 0.01 },
  bloom: { type: "number", uniform: "u_bloom", default: 0.25, min: 0, max: 1, step: 0.01 },
  spots: { type: "number", uniform: "u_spots", default: 4, min: 1, max: 4, step: 1 },
  spotSize: { type: "number", uniform: "u_spotSize", default: 0.5, min: 0, max: 1, step: 0.01 },
  pulse: { type: "number", uniform: "u_pulse", default: 0.25, min: 0, max: 1, step: 0.01 },
  smoke: { type: "number", uniform: "u_smoke", default: 0.3, min: 0, max: 1, step: 0.01 },
  smokeSize: { type: "number", uniform: "u_smokeSize", default: 0.6, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type PulsingBorderConfig = ShaderSourceConfig & {
  colors?: string[];
  colorBack?: string;
  roundness?: number;
  thickness?: number;
  softness?: number;
  intensity?: number;
  bloom?: number;
  spots?: number;
  spotSize?: number;
  pulse?: number;
  smoke?: number;
  smokeSize?: number;
  speed?: number;
};

/** Color spots traveling around a rounded border, pulsing and smoking. */
export class PulsingBorder extends ShaderSource {
  constructor(config: PulsingBorderConfig = {}) {
    super(SCHEMA, pulsingBorderFragmentShader, config);
  }
}

export interface PulsingBorder {
  colors(): string[];
  colors(v: string[]): this;
  colorBack(): string;
  colorBack(v: string): this;
  roundness(): number;
  roundness(v: number): this;
  thickness(): number;
  thickness(v: number): this;
  softness(): number;
  softness(v: number): this;
  intensity(): number;
  intensity(v: number): this;
  bloom(): number;
  bloom(v: number): this;
  spots(): number;
  spots(v: number): this;
  spotSize(): number;
  spotSize(v: number): this;
  pulse(): number;
  pulse(v: number): this;
  smoke(): number;
  smoke(v: number): this;
  smokeSize(): number;
  smokeSize(v: number): this;
  speed(): number;
  speed(v: number): this;
}
