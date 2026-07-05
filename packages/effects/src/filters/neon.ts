import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { Effect, type EffectConfig } from "../effect.js";
import { type ParamSchema, paramsToUniforms } from "../params.js";
import { GLOW_BLUR_FRAG } from "./glow.js";

// Pass 3: neon-tube composite. One blurred alpha field feeds two falloffs —
// a wide outer halo in the tube color and a tighter, whiter inner bloom
// (pow sharpens the field toward the glyph) — while `core` overexposes the
// glyph itself toward coreColor. All added light scales by u_flicker, which
// the TS side derives deterministically from the composition clock.
const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;  // blurred halo field
uniform sampler2D u_original; // untouched input
uniform vec4 u_color;
uniform vec4 u_coreColor;
uniform float u_intensity;
uniform float u_core;
uniform float u_flicker;
out vec4 fragColor;
void main() {
	vec4 o = texture(u_original, v_uv);
	vec4 b = texture(u_texture, v_uv);
	vec3 outer = u_color.rgb * b.a;
	vec3 inner = mix(u_color.rgb, vec3(1.0), 0.65) * pow(b.a, 2.5);
	vec3 halo = (outer + inner) * u_intensity * u_flicker;
	vec3 core = u_coreColor.rgb * u_core * o.a * u_flicker;
	float a = clamp(o.a + b.a * u_intensity * u_color.a * u_flicker, 0.0, 1.0);
	fragColor = vec4(o.rgb + core + halo * (1.0 - o.a), a);
}`;

const SCHEMA: ParamSchema = {
  color: { type: "color", uniform: "u_color", default: "#ff4fd8" },
  coreColor: { type: "color", uniform: "u_coreColor", default: "#ffffff" },
  radius: { type: "number", uniform: null, default: 28, min: 0, max: 100, step: 1 },
  intensity: { type: "number", uniform: "u_intensity", default: 1.2, min: 0, max: 3, step: 0.05 },
  core: { type: "number", uniform: "u_core", default: 0.6, min: 0, max: 2, step: 0.05 },
  flicker: { type: "number", uniform: null, default: 0, min: 0, max: 1, step: 0.01 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type NeonConfig = EffectConfig & {
  color?: string;
  coreColor?: string;
  radius?: number;
  intensity?: number;
  core?: number;
  flicker?: number;
  speed?: number;
};

// Deterministic 0..1 hash (same recipe as GLSL fract(sin) hashes).
function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Neon-tube glow: a hot overexposed core plus a two-layer halo (tight white
 * bloom inside a wide colored wash), with an optional deterministic flicker
 * driven by the composition clock.
 */
export class NeonEffect extends Effect {
  constructor(config: NeonConfig = {}) {
    super(SCHEMA, COMPOSITE_FRAG, config);
  }

  override _kmPadding(_ctx: EffectFrameContext): number {
    return this._values.radius as number;
  }

  override _kmPasses(ctx: EffectFrameContext): EffectPass[] {
    const base = paramsToUniforms(this.schema, this._values, ctx);
    const r = (this._values.radius as number) * ctx.pixelRatio;
    const flicker = this._values.flicker as number;
    const t = base.u_time as number;
    // Continuous hum plus occasional hard dips, both hashed off clock cells so
    // every scrub/render of the same frame flickers identically.
    const cell = Math.floor(t * 16);
    const dip = hash01(cell) > 0.92 ? 0.3 + 0.5 * hash01(cell + 1) : 1;
    const hum = 1 - 0.08 * (0.5 + 0.5 * Math.sin(t * 37));
    base.u_flicker = 1 - flicker * (1 - dip * hum);
    return [
      { fragment: GLOW_BLUR_FRAG, uniforms: { ...base, u_direction: [r, 0], u_threshold: 0 } },
      { fragment: GLOW_BLUR_FRAG, uniforms: { ...base, u_direction: [0, r], u_threshold: 0 } },
      { fragment: COMPOSITE_FRAG, uniforms: base },
    ];
  }
}

export interface NeonEffect {
  color(): string;
  color(v: string): this;
  coreColor(): string;
  coreColor(v: string): this;
  radius(): number;
  radius(v: number): this;
  intensity(): number;
  intensity(v: number): this;
  core(): number;
  core(v: number): this;
  flicker(): number;
  flicker(v: number): this;
  speed(): number;
  speed(v: number): this;
}
