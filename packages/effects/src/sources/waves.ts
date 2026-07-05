import { wavesFragmentShader } from "../glsl/vendor/waves.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react waves.tsx).
const SCHEMA: ParamSchema = {
  colorFront: { type: "color", uniform: "u_colorFront", default: "#ffbb00" },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  shape: { type: "number", uniform: "u_shape", default: 0, min: 0, max: 3, step: 0.01 },
  frequency: { type: "number", uniform: "u_frequency", default: 0.5, min: 0, max: 2, step: 0.01 },
  amplitude: { type: "number", uniform: "u_amplitude", default: 0.5, min: 0, max: 1, step: 0.01 },
  spacing: { type: "number", uniform: "u_spacing", default: 1.2, min: 0, max: 2, step: 0.01 },
  proportion: { type: "number", uniform: "u_proportion", default: 0.1, min: 0, max: 1, step: 0.01 },
  softness: { type: "number", uniform: "u_softness", default: 0, min: 0, max: 1, step: 0.01 },
};

export type WavesConfig = ShaderSourceConfig & {
  colorFront?: string;
  colorBack?: string;
  shape?: number;
  frequency?: number;
  amplitude?: number;
  spacing?: number;
  proportion?: number;
  softness?: number;
};

export class Waves extends ShaderSource {
  constructor(config: WavesConfig = {}) {
    super(SCHEMA, wavesFragmentShader, config);
  }
}

export interface Waves {
  colorFront(): string;
  colorFront(v: string): this;
  colorBack(): string;
  colorBack(v: string): this;
  shape(): number;
  shape(v: number): this;
  frequency(): number;
  frequency(v: number): this;
  amplitude(): number;
  amplitude(v: number): this;
  spacing(): number;
  spacing(v: number): this;
  proportion(): number;
  proportion(v: number): this;
  softness(): number;
  softness(v: number): this;
}
