import { gemSmokeFragmentShader } from "../glsl/vendor/gem-smoke.js";
import { ImageShaderSource, type ImageShaderSourceConfig } from "../image-source.js";
import type { ParamSchema } from "../params.js";
import { computeEdgeField } from "../processing/edge-field.js";

// Defaults mirror upstream's Default preset (shaders-react gem-smoke.tsx).
const SCHEMA: ParamSchema = {
  colors: { type: "colors", uniform: "u_colors", default: ["#333333", "#e7e6df"], max: 6 },
  colorBack: { type: "color", uniform: "u_colorBack", default: "#f0efea" },
  colorInner: { type: "color", uniform: "u_colorInner", default: "#fafaf5" },
  outerGlow: { type: "number", uniform: "u_outerGlow", default: 0.55, min: 0, max: 1, step: 0.01 },
  innerGlow: { type: "number", uniform: "u_innerGlow", default: 1, min: 0, max: 1, step: 0.01 },
  innerDistortion: {
    type: "number",
    uniform: "u_innerDistortion",
    default: 0.8,
    min: 0,
    max: 1,
    step: 0.01,
  },
  outerDistortion: {
    type: "number",
    uniform: "u_outerDistortion",
    default: 0.6,
    min: 0,
    max: 1,
    step: 0.01,
  },
  offset: { type: "number", uniform: "u_offset", default: 0, min: -1, max: 1, step: 0.01 },
  angle: { type: "number", uniform: "u_angle", default: 0, min: 0, max: 360, step: 1 },
  smokeSize: { type: "number", uniform: "u_size", default: 0.8, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type GemSmokeConfig = ImageShaderSourceConfig & {
  colors?: string[];
  colorBack?: string;
  colorInner?: string;
  outerGlow?: number;
  innerGlow?: number;
  innerDistortion?: number;
  outerDistortion?: number;
  offset?: number;
  angle?: number;
  /** Upstream calls this `size`; renamed because Konva.Shape already has size(). */
  smokeSize?: number;
  speed?: number;
};

/**
 * The paper-design gem-smoke logo animation: soft smoke curling through and
 * around a source image (its `src`), driven by a pre-processed Poisson edge
 * field with a little padding so the smoke can escape the shape.
 */
export class GemSmoke extends ImageShaderSource {
  constructor(config: GemSmokeConfig) {
    super(SCHEMA, gemSmokeFragmentShader, (img) => computeEdgeField(img, 0.025), config);
  }
}

export interface GemSmoke {
  colors(): string[];
  colors(v: string[]): this;
  colorBack(): string;
  colorBack(v: string): this;
  colorInner(): string;
  colorInner(v: string): this;
  outerGlow(): number;
  outerGlow(v: number): this;
  innerGlow(): number;
  innerGlow(v: number): this;
  innerDistortion(): number;
  innerDistortion(v: number): this;
  outerDistortion(): number;
  outerDistortion(v: number): this;
  // `offset` accessor type comes from Konva.Node's GetSet (name collision).
  angle(): number;
  angle(v: number): this;
  smokeSize(): number;
  smokeSize(v: number): this;
  speed(): number;
  speed(v: number): this;
}
