import { staticRadialGradientFragmentShader } from "../glsl/vendor/static-radial-gradient.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react static-radial-gradient.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#00bbff", "#00ffe1", "#ffffff"],
    max: 10,
  },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  radius: { type: "number", uniform: "u_radius", default: 0.8, min: 0, max: 2, step: 0.01 },
  focalDistance: {
    type: "number",
    uniform: "u_focalDistance",
    default: 0.99,
    min: 0,
    max: 2,
    step: 0.01,
  },
  focalAngle: { type: "number", uniform: "u_focalAngle", default: 0, min: 0, max: 360, step: 1 },
  falloff: { type: "number", uniform: "u_falloff", default: 0.24, min: -1, max: 1, step: 0.01 },
  mixing: { type: "number", uniform: "u_mixing", default: 0.5, min: 0, max: 1, step: 0.01 },
  distortion: { type: "number", uniform: "u_distortion", default: 0, min: 0, max: 1, step: 0.01 },
  distortionShift: {
    type: "number",
    uniform: "u_distortionShift",
    default: 0,
    min: -1,
    max: 1,
    step: 0.01,
  },
  distortionFreq: {
    type: "number",
    uniform: "u_distortionFreq",
    default: 12,
    min: 0,
    max: 20,
    step: 1,
  },
  grainMixer: { type: "number", uniform: "u_grainMixer", default: 0, min: 0, max: 1, step: 0.01 },
  grainOverlay: {
    type: "number",
    uniform: "u_grainOverlay",
    default: 0,
    min: 0,
    max: 1,
    step: 0.01,
  },
};

export type StaticRadialGradientConfig = ShaderSourceConfig & {
  colors?: string[];
  colorBack?: string;
  radius?: number;
  focalDistance?: number;
  focalAngle?: number;
  falloff?: number;
  mixing?: number;
  distortion?: number;
  distortionShift?: number;
  distortionFreq?: number;
  grainMixer?: number;
  grainOverlay?: number;
};

/** Still radial gradient with focal offset, falloff and distortion. */
export class StaticRadialGradient extends ShaderSource {
  constructor(config: StaticRadialGradientConfig = {}) {
    super(SCHEMA, staticRadialGradientFragmentShader, config);
  }
}

export interface StaticRadialGradient {
  colors(): string[];
  colors(v: string[]): this;
  colorBack(): string;
  colorBack(v: string): this;
  radius(): number;
  radius(v: number): this;
  focalDistance(): number;
  focalDistance(v: number): this;
  focalAngle(): number;
  focalAngle(v: number): this;
  falloff(): number;
  falloff(v: number): this;
  mixing(): number;
  mixing(v: number): this;
  distortion(): number;
  distortion(v: number): this;
  distortionShift(): number;
  distortionShift(v: number): this;
  distortionFreq(): number;
  distortionFreq(v: number): this;
  grainMixer(): number;
  grainMixer(v: number): this;
  grainOverlay(): number;
  grainOverlay(v: number): this;
}
