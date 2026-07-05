import { grainGradientFragmentShader } from "../glsl/vendor/grain-gradient.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react grain-gradient.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#7300ff", "#eba8ff", "#00bfff", "#2a00ff"],
    max: 7,
  },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  softness: { type: "number", uniform: "u_softness", default: 0.5, min: 0, max: 1, step: 0.01 },
  intensity: { type: "number", uniform: "u_intensity", default: 0.5, min: 0, max: 1, step: 0.01 },
  noise: { type: "number", uniform: "u_noise", default: 0.25, min: 0, max: 1, step: 0.01 },
  shape: {
    type: "enum",
    uniform: "u_shape",
    default: "corners",
    values: ["wave", "dots", "truchet", "corners", "ripple", "blob", "sphere"],
    valueMap: { wave: 1, dots: 2, truchet: 3, corners: 4, ripple: 5, blob: 6, sphere: 7 },
  },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type GrainGradientConfig = ShaderSourceConfig & {
  colors?: string[];
  colorBack?: string;
  softness?: number;
  intensity?: number;
  noise?: number;
  shape?: string;
  speed?: number;
};

/** Grainy animated gradient over one of seven procedural shapes. */
export class GrainGradient extends ShaderSource {
  constructor(config: GrainGradientConfig = {}) {
    super(SCHEMA, grainGradientFragmentShader, config);
  }
}

export interface GrainGradient {
  colors(): string[];
  colors(v: string[]): this;
  colorBack(): string;
  colorBack(v: string): this;
  softness(): number;
  softness(v: number): this;
  intensity(): number;
  intensity(v: number): this;
  // `noise` accessor type comes from Konva.Node's GetSet (name collision).
  shape(): string;
  shape(v: string): this;
  speed(): number;
  speed(v: number): this;
}
