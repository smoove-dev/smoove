import { dotOrbitFragmentShader } from "../glsl/vendor/dot-orbit.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react dot-orbit.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#ffc96b", "#ff6200", "#ff2f00", "#421100", "#1a0000"],
    max: 10,
  },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  dotSize: { type: "number", uniform: "u_size", default: 1, min: 0, max: 1, step: 0.01 },
  sizeRange: { type: "number", uniform: "u_sizeRange", default: 0, min: 0, max: 1, step: 0.01 },
  spreading: { type: "number", uniform: "u_spreading", default: 1, min: 0, max: 1, step: 0.01 },
  stepsPerColor: {
    type: "number",
    uniform: "u_stepsPerColor",
    default: 4,
    min: 1,
    max: 10,
    step: 1,
  },
  speed: { type: "number", uniform: null, default: 1.5, min: -5, max: 5, step: 0.1 },
};

export type DotOrbitConfig = ShaderSourceConfig & {
  colors?: string[];
  colorBack?: string;
  dotSize?: number;
  sizeRange?: number;
  spreading?: number;
  stepsPerColor?: number;
  speed?: number;
};

/** Dots orbiting on a grid with per-cell color and size randomization. */
export class DotOrbit extends ShaderSource {
  constructor(config: DotOrbitConfig = {}) {
    super(SCHEMA, dotOrbitFragmentShader, config);
  }
}

export interface DotOrbit {
  colors(): string[];
  colors(v: string[]): this;
  colorBack(): string;
  colorBack(v: string): this;
  dotSize(): number;
  dotSize(v: number): this;
  sizeRange(): number;
  sizeRange(v: number): this;
  spreading(): number;
  spreading(v: number): this;
  stepsPerColor(): number;
  stepsPerColor(v: number): this;
  speed(): number;
  speed(v: number): this;
}
