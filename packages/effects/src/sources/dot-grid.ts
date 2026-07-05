import { dotGridFragmentShader } from "../glsl/vendor/dot-grid.js";
import type { ParamSchema } from "../params.js";
import { ShaderSource, type ShaderSourceConfig } from "../source.js";

// Defaults mirror upstream's Default preset (shaders-react dot-grid.tsx).
const SCHEMA: ParamSchema = {
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  colorFill: { type: "color", uniform: "u_colorFill", default: "#ffffff" },
  colorStroke: { type: "color", uniform: "u_colorStroke", default: "#ffaa00" },
  dotSize: { type: "number", uniform: "u_dotSize", default: 2, min: 1, max: 100, step: 1 },
  gapX: { type: "number", uniform: "u_gapX", default: 32, min: 2, max: 500, step: 1 },
  gapY: { type: "number", uniform: "u_gapY", default: 32, min: 2, max: 500, step: 1 },
  lineWidth: { type: "number", uniform: "u_strokeWidth", default: 0, min: 0, max: 50, step: 0.5 },
  sizeRange: { type: "number", uniform: "u_sizeRange", default: 0, min: 0, max: 1, step: 0.01 },
  opacityRange: {
    type: "number",
    uniform: "u_opacityRange",
    default: 0,
    min: 0,
    max: 1,
    step: 0.01,
  },
  shape: {
    type: "enum",
    uniform: "u_shape",
    default: "circle",
    values: ["circle", "diamond", "square", "triangle"],
    valueMap: { circle: 0, diamond: 1, square: 2, triangle: 3 },
  },
};

export type DotGridConfig = ShaderSourceConfig & {
  colorBack?: string;
  colorFill?: string;
  colorStroke?: string;
  dotSize?: number;
  gapX?: number;
  gapY?: number;
  lineWidth?: number;
  sizeRange?: number;
  opacityRange?: number;
  shape?: string;
};

/** Static grid of circles, diamonds, squares or triangles. */
export class DotGrid extends ShaderSource {
  constructor(config: DotGridConfig = {}) {
    super(SCHEMA, dotGridFragmentShader, config);
  }
}

export interface DotGrid {
  colorBack(): string;
  colorBack(v: string): this;
  colorFill(): string;
  colorFill(v: string): this;
  colorStroke(): string;
  colorStroke(v: string): this;
  dotSize(): number;
  dotSize(v: number): this;
  gapX(): number;
  gapX(v: number): this;
  gapY(): number;
  gapY(v: number): this;
  lineWidth(): number;
  lineWidth(v: number): this;
  sizeRange(): number;
  sizeRange(v: number): this;
  opacityRange(): number;
  opacityRange(v: number): this;
  shape(): string;
  shape(v: string): this;
}
