import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { Effect, type EffectConfig } from "../effect.js";
import { waterFragmentShader } from "../glsl/vendor/water.js";
import type { ParamSchema } from "../params.js";

// Defaults mirror upstream's Default preset (shaders-react water.tsx), except
// colorBack: transparent so the filtered node keeps its own backdrop.
const SCHEMA: ParamSchema = {
  colorBack: { type: "color", uniform: "u_colorBack", default: "#00000000" },
  colorHighlight: { type: "color", uniform: "u_colorHighlight", default: "#ffffff" },
  highlights: {
    type: "number",
    uniform: "u_highlights",
    default: 0.07,
    min: 0,
    max: 1,
    step: 0.01,
  },
  layering: { type: "number", uniform: "u_layering", default: 0.5, min: 0, max: 1, step: 0.01 },
  edges: { type: "number", uniform: "u_edges", default: 0.8, min: 0, max: 1, step: 0.01 },
  waves: { type: "number", uniform: "u_waves", default: 0.3, min: 0, max: 1, step: 0.01 },
  caustic: { type: "number", uniform: "u_caustic", default: 0.1, min: 0, max: 1, step: 0.01 },
  size: { type: "number", uniform: "u_size", default: 1, min: 0.01, max: 7, step: 0.01 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type WaterConfig = EffectConfig & {
  colorBack?: string;
  colorHighlight?: string;
  highlights?: number;
  layering?: number;
  edges?: number;
  waves?: number;
  caustic?: number;
  size?: number;
  speed?: number;
};

/** Caustic water-surface distortion over the node's pixels (ported from paper-design/shaders). */
export class WaterEffect extends Effect {
  constructor(config: WaterConfig = {}) {
    super(SCHEMA, waterFragmentShader, config);
  }

  /** The caustic displacement can pull edge pixels outward — conservative fixed bleed. */
  override _kmPadding(_ctx: EffectFrameContext): number {
    return 40;
  }

  override _kmPasses(ctx: EffectFrameContext): EffectPass[] {
    const passes = super._kmPasses(ctx);
    for (const p of passes) p.uniforms.u_imageAspectRatio = ctx.width / ctx.height;
    return passes;
  }
}

export interface WaterEffect {
  colorBack(): string;
  colorBack(v: string): this;
  colorHighlight(): string;
  colorHighlight(v: string): this;
  highlights(): number;
  highlights(v: number): this;
  layering(): number;
  layering(v: number): this;
  edges(): number;
  edges(v: number): this;
  waves(): number;
  waves(v: number): this;
  caustic(): number;
  caustic(v: number): this;
  size(): number;
  size(v: number): this;
  speed(): number;
  speed(v: number): this;
}
