import { neuroNoiseFragmentShader } from "../glsl/vendor/neuro-noise.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react neuro-noise.tsx).
const SCHEMA: ParamSchema = {
  colorFront: { type: "color", uniform: "u_colorFront", default: "#ffffff" },
  colorMid: { type: "color", uniform: "u_colorMid", default: "#47a6ff" },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  brightness: {
    type: "number",
    uniform: "u_brightness",
    default: 0.05,
    min: 0,
    max: 1,
    step: 0.01,
  },
  contrast: { type: "number", uniform: "u_contrast", default: 0.3, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type NeuroNoiseConfig = ShaderSourceConfig & {
  colorFront?: string;
  colorMid?: string;
  colorBack?: string;
  brightness?: number;
  contrast?: number;
  speed?: number;
};

/** Fractal-like neural net of glowing threads. */
export class NeuroNoise extends ShaderSource {
  constructor(config: NeuroNoiseConfig = {}) {
    super(SCHEMA, neuroNoiseFragmentShader, config);
  }
}

export interface NeuroNoise {
  colorFront(): string;
  colorFront(v: string): this;
  colorMid(): string;
  colorMid(v: string): this;
  colorBack(): string;
  colorBack(v: string): this;
  // `brightness` accessor type comes from Konva.Node's GetSet (name collision).
  // `contrast` accessor type comes from Konva.Node's GetSet (name collision).
  speed(): number;
  speed(v: number): this;
}
