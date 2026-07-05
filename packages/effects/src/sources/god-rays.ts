import { godRaysFragmentShader } from "../glsl/vendor/god-rays.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react god-rays.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#a600ff6e", "#6200fff0", "#ffffff", "#33fff5"],
    max: 5,
  },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  colorBloom: { type: "color", uniform: "u_colorBloom", default: "#0000ff" },
  density: { type: "number", uniform: "u_density", default: 0.3, min: 0, max: 1, step: 0.01 },
  spotty: { type: "number", uniform: "u_spotty", default: 0.3, min: 0, max: 1, step: 0.01 },
  midSize: { type: "number", uniform: "u_midSize", default: 0.2, min: 0, max: 1, step: 0.01 },
  midIntensity: {
    type: "number",
    uniform: "u_midIntensity",
    default: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
  },
  intensity: { type: "number", uniform: "u_intensity", default: 0.8, min: 0, max: 1, step: 0.01 },
  bloom: { type: "number", uniform: "u_bloom", default: 0.4, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 0.75, min: -5, max: 5, step: 0.1 },
};

export type GodRaysConfig = ShaderSourceConfig & {
  colors?: string[];
  colorBack?: string;
  colorBloom?: string;
  density?: number;
  spotty?: number;
  midSize?: number;
  midIntensity?: number;
  intensity?: number;
  bloom?: number;
  speed?: number;
};

export class GodRays extends ShaderSource {
  constructor(config: GodRaysConfig = {}) {
    super(SCHEMA, godRaysFragmentShader, config);
  }
}

export interface GodRays {
  colors(): string[];
  colors(v: string[]): this;
  colorBack(): string;
  colorBack(v: string): this;
  colorBloom(): string;
  colorBloom(v: string): this;
  density(): number;
  density(v: number): this;
  spotty(): number;
  spotty(v: number): this;
  midSize(): number;
  midSize(v: number): this;
  midIntensity(): number;
  midIntensity(v: number): this;
  intensity(): number;
  intensity(v: number): this;
  bloom(): number;
  bloom(v: number): this;
  speed(): number;
  speed(v: number): this;
}
