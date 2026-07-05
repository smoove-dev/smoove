import { voronoiFragmentShader } from "../glsl/vendor/voronoi.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react voronoi.tsx).
const SCHEMA: ParamSchema = {
  colors: { type: "colors", uniform: "u_colors", default: ["#ff8247", "#ffe53d"], max: 5 },
  colorGlow: { type: "color", uniform: "u_colorGlow", default: "#ffffff" },
  colorGap: { type: "color", uniform: "u_colorGap", default: "#2e0000" },
  stepsPerColor: {
    type: "number",
    uniform: "u_stepsPerColor",
    default: 3,
    min: 1,
    max: 10,
    step: 1,
  },
  distortion: {
    type: "number",
    uniform: "u_distortion",
    default: 0.4,
    min: 0,
    max: 0.5,
    step: 0.01,
  },
  gap: { type: "number", uniform: "u_gap", default: 0.04, min: 0, max: 0.1, step: 0.005 },
  glow: { type: "number", uniform: "u_glow", default: 0, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 0.5, min: -5, max: 5, step: 0.1 },
};

export type VoronoiConfig = ShaderSourceConfig & {
  colors?: string[];
  colorGlow?: string;
  colorGap?: string;
  stepsPerColor?: number;
  distortion?: number;
  gap?: number;
  glow?: number;
  speed?: number;
};

/** Animated Voronoi cells with adjustable gaps and glow. */
export class Voronoi extends ShaderSource {
  constructor(config: VoronoiConfig = {}) {
    super(SCHEMA, voronoiFragmentShader, config);
  }
}

export interface Voronoi {
  colors(): string[];
  colors(v: string[]): this;
  colorGlow(): string;
  colorGlow(v: string): this;
  colorGap(): string;
  colorGap(v: string): this;
  stepsPerColor(): number;
  stepsPerColor(v: number): this;
  distortion(): number;
  distortion(v: number): this;
  gap(): number;
  gap(v: number): this;
  glow(): number;
  glow(v: number): this;
  speed(): number;
  speed(v: number): this;
}
