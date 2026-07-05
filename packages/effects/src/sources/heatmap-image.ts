import { heatmapFragmentShader } from "../glsl/vendor/heatmap.js";
import { ImageShaderSource, type ImageShaderSourceConfig } from "../image-source.js";
import type { ParamSchema } from "../params.js";
import { computeHeatmapField } from "../processing/heatmap-field.js";

// Defaults mirror upstream's Default preset (shaders-react heatmap.tsx).
const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#11206a", "#1f3ba2", "#2f63e7", "#6bd7ff", "#ffe679", "#ff991e", "#ff4c00"],
    max: 10,
  },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#000000" },
  contour: { type: "number", uniform: "u_contour", default: 0.5, min: 0, max: 1, step: 0.01 },
  angle: { type: "number", uniform: "u_angle", default: 0, min: 0, max: 360, step: 1 },
  noise: { type: "number", uniform: "u_noise", default: 0, min: 0, max: 1, step: 0.01 },
  innerGlow: { type: "number", uniform: "u_innerGlow", default: 0.5, min: 0, max: 1, step: 0.01 },
  outerGlow: { type: "number", uniform: "u_outerGlow", default: 0.5, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type HeatmapConfig = ImageShaderSourceConfig & {
  colors?: string[];
  colorBack?: string;
  contour?: number;
  angle?: number;
  noise?: number;
  innerGlow?: number;
  outerGlow?: number;
  speed?: number;
};

/**
 * The paper-design heatmap logo animation: heat shimmer rising through a
 * source image (its `src`), driven by a pre-processed multi-scale blur field.
 */
export class Heatmap extends ImageShaderSource {
  constructor(config: HeatmapConfig) {
    super(SCHEMA, heatmapFragmentShader, (img) => computeHeatmapField(img), config);
  }
}

export interface Heatmap {
  colors(): string[];
  colors(v: string[]): this;
  colorBack(): string;
  colorBack(v: string): this;
  contour(): number;
  contour(v: number): this;
  angle(): number;
  angle(v: number): this;
  // `noise` accessor type comes from Konva.Node's GetSet (name collision).
  innerGlow(): number;
  innerGlow(v: number): this;
  outerGlow(): number;
  outerGlow(v: number): this;
  speed(): number;
  speed(v: number): this;
}
