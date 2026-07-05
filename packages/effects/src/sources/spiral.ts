import { spiralFragmentShader } from "../glsl/vendor/spiral.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react spiral.tsx).
const SCHEMA: ParamSchema = {
  colorBack: { type: "color", uniform: "u_colorBack", default: "#001429" },
  colorFront: { type: "color", uniform: "u_colorFront", default: "#79D1FF" },
  density: { type: "number", uniform: "u_density", default: 1, min: 0, max: 1, step: 0.01 },
  distortion: { type: "number", uniform: "u_distortion", default: 0, min: 0, max: 1, step: 0.01 },
  lineWidth: { type: "number", uniform: "u_strokeWidth", default: 0.5, min: 0, max: 1, step: 0.01 },
  strokeTaper: { type: "number", uniform: "u_strokeTaper", default: 0, min: 0, max: 1, step: 0.01 },
  strokeCap: { type: "number", uniform: "u_strokeCap", default: 0, min: 0, max: 1, step: 0.01 },
  noise: { type: "number", uniform: "u_noise", default: 0, min: 0, max: 1, step: 0.01 },
  noiseFrequency: {
    type: "number",
    uniform: "u_noiseFrequency",
    default: 0,
    min: 0,
    max: 1,
    step: 0.01,
  },
  softness: { type: "number", uniform: "u_softness", default: 0, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type SpiralConfig = ShaderSourceConfig & {
  colorBack?: string;
  colorFront?: string;
  density?: number;
  distortion?: number;
  lineWidth?: number;
  strokeTaper?: number;
  strokeCap?: number;
  noise?: number;
  noiseFrequency?: number;
  softness?: number;
  speed?: number;
};

/** Archimedean spiral with distortion, taper and noise controls. */
export class Spiral extends ShaderSource {
  constructor(config: SpiralConfig = {}) {
    super(SCHEMA, spiralFragmentShader, config);
  }
}

export interface Spiral {
  colorBack(): string;
  colorBack(v: string): this;
  colorFront(): string;
  colorFront(v: string): this;
  density(): number;
  density(v: number): this;
  distortion(): number;
  distortion(v: number): this;
  lineWidth(): number;
  lineWidth(v: number): this;
  strokeTaper(): number;
  strokeTaper(v: number): this;
  strokeCap(): number;
  strokeCap(v: number): this;
  // `noise` accessor type comes from Konva.Node's GetSet (name collision).
  noiseFrequency(): number;
  noiseFrequency(v: number): this;
  softness(): number;
  softness(v: number): this;
  speed(): number;
  speed(v: number): this;
}
