import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { Effect, type EffectConfig } from "../effect.js";
import { type ParamSchema, paramsToUniforms } from "../params.js";
import { GLOW_BLUR_FRAG, GLOW_COMPOSITE_FRAG } from "./glow.js";

// GlowEffect's exact pass chain, but the halo breathes on the composition
// clock: intensity rises from `intensity × (1 − depth)` to `intensity` and
// back once per `period` seconds (raised cosine, starting at the dim end).
// Zero-wiring standby/on-air pulse — no register() callback needed.
const SCHEMA: ParamSchema = {
  color: { type: "color", uniform: "u_color", default: "#ffffff" },
  radius: { type: "number", uniform: null, default: 20, min: 0, max: 100, step: 1 },
  intensity: { type: "number", uniform: null, default: 1.4, min: 0, max: 3, step: 0.05 },
  depth: { type: "number", uniform: null, default: 0.7, min: 0, max: 1, step: 0.01 },
  period: { type: "number", uniform: null, default: 1.8, min: 0.1, max: 10, step: 0.1 },
  threshold: { type: "number", uniform: "u_threshold", default: 0, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type PulseGlowConfig = EffectConfig & {
  color?: string;
  radius?: number;
  intensity?: number;
  depth?: number;
  period?: number;
  threshold?: number;
  speed?: number;
};

/** A glow halo that breathes on the composition clock — peak `intensity`, dipping by `depth` once per `period` seconds. */
export class PulseGlowEffect extends Effect {
  constructor(config: PulseGlowConfig = {}) {
    super(SCHEMA, GLOW_COMPOSITE_FRAG, config);
  }

  override _kmPasses(ctx: EffectFrameContext): EffectPass[] {
    const base = paramsToUniforms(this.schema, this._values, ctx);
    const r = this._values.radius as number;
    const peak = this._values.intensity as number;
    const depth = this._values.depth as number;
    const period = this._values.period as number;
    const t = base.u_time as number;
    const wave = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / period); // 0 → 1 → 0
    base.u_intensity = peak * (1 - depth + depth * wave);
    return [
      { fragment: GLOW_BLUR_FRAG, uniforms: { ...base, u_direction: [r, 0] } },
      { fragment: GLOW_BLUR_FRAG, uniforms: { ...base, u_direction: [0, r], u_threshold: 0 } },
      { fragment: GLOW_COMPOSITE_FRAG, uniforms: base },
    ];
  }
}

export interface PulseGlowEffect {
  color(): string;
  color(v: string): this;
  radius(): number;
  radius(v: number): this;
  intensity(): number;
  intensity(v: number): this;
  depth(): number;
  depth(v: number): this;
  period(): number;
  period(v: number): this;
  threshold(): number;
  threshold(v: number): this;
  speed(): number;
  speed(v: number): this;
}
