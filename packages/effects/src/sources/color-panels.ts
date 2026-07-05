import { colorPanelsFragmentShader } from "../glsl/vendor/color-panels.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react color-panels.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#ff9d00", "#fd4f30", "#809bff", "#6d2eff", "#333aff", "#f15cff", "#ffd557"],
    max: 7,
  },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  angle1: { type: "number", uniform: "u_angle1", default: 0, min: -1, max: 1, step: 0.01 },
  angle2: { type: "number", uniform: "u_angle2", default: 0, min: -1, max: 1, step: 0.01 },
  panelLength: { type: "number", uniform: "u_length", default: 1.1, min: 0, max: 3, step: 0.01 },
  edges: { type: "boolean", uniform: "u_edges", default: false },
  blur: { type: "number", uniform: "u_blur", default: 0, min: 0, max: 0.5, step: 0.01 },
  fadeIn: { type: "number", uniform: "u_fadeIn", default: 1, min: 0, max: 1, step: 0.01 },
  fadeOut: { type: "number", uniform: "u_fadeOut", default: 0.3, min: 0, max: 1, step: 0.01 },
  gradient: { type: "number", uniform: "u_gradient", default: 0, min: 0, max: 1, step: 0.01 },
  density: { type: "number", uniform: "u_density", default: 3, min: 0.25, max: 7, step: 0.05 },
  speed: { type: "number", uniform: null, default: 0.5, min: -5, max: 5, step: 0.1 },
};

export type ColorPanelsConfig = ShaderSourceConfig & {
  colors?: string[];
  colorBack?: string;
  angle1?: number;
  angle2?: number;
  panelLength?: number;
  edges?: boolean;
  blur?: number;
  fadeIn?: number;
  fadeOut?: number;
  gradient?: number;
  density?: number;
  speed?: number;
};

/** Rotating translucent color panels around a vertical axis. */
export class ColorPanels extends ShaderSource {
  constructor(config: ColorPanelsConfig = {}) {
    super(SCHEMA, colorPanelsFragmentShader, config);
  }
}

export interface ColorPanels {
  colors(): string[];
  colors(v: string[]): this;
  colorBack(): string;
  colorBack(v: string): this;
  angle1(): number;
  angle1(v: number): this;
  angle2(): number;
  angle2(v: number): this;
  panelLength(): number;
  panelLength(v: number): this;
  edges(): boolean;
  edges(v: boolean): this;
  blur(): number;
  blur(v: number): this;
  fadeIn(): number;
  fadeIn(v: number): this;
  fadeOut(): number;
  fadeOut(v: number): this;
  gradient(): number;
  gradient(v: number): this;
  density(): number;
  density(v: number): this;
  speed(): number;
  speed(v: number): this;
}
