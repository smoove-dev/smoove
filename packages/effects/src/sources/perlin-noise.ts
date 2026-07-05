import { perlinNoiseFragmentShader } from "../glsl/vendor/perlin-noise.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react perlin-noise.tsx).
const SCHEMA: ParamSchema = {
  colorBack: { type: "color", uniform: "u_colorBack", default: "#632ad5" },
  colorFront: { type: "color", uniform: "u_colorFront", default: "#fccff7" },
  proportion: {
    type: "number",
    uniform: "u_proportion",
    default: 0.35,
    min: 0,
    max: 1,
    step: 0.01,
  },
  softness: { type: "number", uniform: "u_softness", default: 0.1, min: 0, max: 1, step: 0.01 },
  octaveCount: { type: "number", uniform: "u_octaveCount", default: 1, min: 1, max: 8, step: 1 },
  persistence: {
    type: "number",
    uniform: "u_persistence",
    default: 1,
    min: 0.3,
    max: 1,
    step: 0.01,
  },
  lacunarity: {
    type: "number",
    uniform: "u_lacunarity",
    default: 1.5,
    min: 1.5,
    max: 3,
    step: 0.05,
  },
  speed: { type: "number", uniform: null, default: 0.5, min: -5, max: 5, step: 0.1 },
};

export type PerlinNoiseConfig = ShaderSourceConfig & {
  colorBack?: string;
  colorFront?: string;
  proportion?: number;
  softness?: number;
  octaveCount?: number;
  persistence?: number;
  lacunarity?: number;
  speed?: number;
};

/** Classic two-color Perlin noise with octave control. */
export class PerlinNoise extends ShaderSource {
  constructor(config: PerlinNoiseConfig = {}) {
    super(SCHEMA, perlinNoiseFragmentShader, config);
  }
}

export interface PerlinNoise {
  colorBack(): string;
  colorBack(v: string): this;
  colorFront(): string;
  colorFront(v: string): this;
  proportion(): number;
  proportion(v: number): this;
  softness(): number;
  softness(v: number): this;
  octaveCount(): number;
  octaveCount(v: number): this;
  persistence(): number;
  persistence(v: number): this;
  lacunarity(): number;
  lacunarity(v: number): this;
  speed(): number;
  speed(v: number): this;
}
