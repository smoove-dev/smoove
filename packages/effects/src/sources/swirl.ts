import { swirlFragmentShader } from "../glsl/vendor/swirl.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react swirl.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#ffd1d1", "#ff8a8a", "#660000"],
    max: 10,
  },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#330000" },
  bandCount: { type: "number", uniform: "u_bandCount", default: 4, min: 0, max: 15, step: 1 },
  twist: { type: "number", uniform: "u_twist", default: 0.1, min: 0, max: 1, step: 0.01 },
  center: { type: "number", uniform: "u_center", default: 0.2, min: 0, max: 1, step: 0.01 },
  proportion: { type: "number", uniform: "u_proportion", default: 0.5, min: 0, max: 1, step: 0.01 },
  softness: { type: "number", uniform: "u_softness", default: 0, min: 0, max: 1, step: 0.01 },
  noiseFrequency: {
    type: "number",
    uniform: "u_noiseFrequency",
    default: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
  },
  noise: { type: "number", uniform: "u_noise", default: 0.2, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 0.32, min: -5, max: 5, step: 0.01 },
};

export type SwirlConfig = ShaderSourceConfig & {
  colors?: string[];
  colorBack?: string;
  bandCount?: number;
  twist?: number;
  center?: number;
  proportion?: number;
  softness?: number;
  noiseFrequency?: number;
  noise?: number;
  speed?: number;
};

/** Color bands twisting around the center. */
export class Swirl extends ShaderSource {
  constructor(config: SwirlConfig = {}) {
    super(SCHEMA, swirlFragmentShader, config);
  }
}

export interface Swirl {
  colors(): string[];
  colors(v: string[]): this;
  colorBack(): string;
  colorBack(v: string): this;
  bandCount(): number;
  bandCount(v: number): this;
  twist(): number;
  twist(v: number): this;
  center(): number;
  center(v: number): this;
  proportion(): number;
  proportion(v: number): this;
  softness(): number;
  softness(v: number): this;
  noiseFrequency(): number;
  noiseFrequency(v: number): this;
  // `noise` accessor type comes from Konva.Node's GetSet (name collision).
  speed(): number;
  speed(v: number): this;
}
