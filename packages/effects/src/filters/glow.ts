import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { Effect, type EffectConfig } from "../effect.js";
import { type ParamSchema, paramsToUniforms } from "../params.js";

// Pass 1: horizontal blur of the bright/alpha regions. Exported (not via the
// package barrel) so glow-shaped effects like PulseGlow share the compiled
// programs — the runtime keys its program cache on the fragment string.
export const GLOW_BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_direction;
uniform float u_threshold; // only on pass 1 (0 on pass 2)
out vec4 fragColor;
void main() {
	vec2 step = u_direction / u_resolution;
	vec4 acc = vec4(0.0);
	float total = 0.0;
	for (int i = -7; i <= 7; i++) {
		float t = float(i) / 7.0;
		float w = exp(-t * t * 3.0);
		vec4 s = texture(u_texture, v_uv + step * t);
		float lum = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
		s *= smoothstep(u_threshold, u_threshold + 0.1, max(lum, s.a));
		acc += s * w;
		total += w;
	}
	fragColor = acc / total;
}`;

// Pass 3: additive composite of the blurred halo over the original.
export const GLOW_COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;  // blurred halo
uniform sampler2D u_original; // untouched input
uniform vec4 u_color;
uniform float u_intensity;
out vec4 fragColor;
void main() {
	vec4 o = texture(u_original, v_uv);
	vec4 b = texture(u_texture, v_uv);
	vec3 halo = u_color.rgb * b.a * u_intensity;
	float a = clamp(o.a + b.a * u_intensity * u_color.a, 0.0, 1.0);
	fragColor = vec4(o.rgb + halo * (1.0 - o.a), a);
}`;

const SCHEMA: ParamSchema = {
  radius: { type: "number", uniform: null, default: 16, min: 0, max: 100, step: 1 },
  intensity: { type: "number", uniform: "u_intensity", default: 0.8, min: 0, max: 3, step: 0.05 },
  color: { type: "color", uniform: "u_color", default: "#ffffff" },
  threshold: { type: "number", uniform: "u_threshold", default: 0, min: 0, max: 1, step: 0.01 },
};

export type GlowConfig = EffectConfig & {
  radius?: number;
  intensity?: number;
  color?: string;
  threshold?: number;
};

export class GlowEffect extends Effect {
  constructor(config: GlowConfig = {}) {
    super(SCHEMA, GLOW_COMPOSITE_FRAG, config);
  }

  override _kmPadding(_ctx: EffectFrameContext): number {
    return this._values.radius as number;
  }

  override _kmPasses(ctx: EffectFrameContext): EffectPass[] {
    const base = paramsToUniforms(this.schema, this._values, ctx);
    const r = (this._values.radius as number) * ctx.pixelRatio;
    return [
      { fragment: GLOW_BLUR_FRAG, uniforms: { ...base, u_direction: [r, 0] } },
      { fragment: GLOW_BLUR_FRAG, uniforms: { ...base, u_direction: [0, r], u_threshold: 0 } },
      { fragment: GLOW_COMPOSITE_FRAG, uniforms: base },
    ];
  }
}

export interface GlowEffect {
  radius(): number;
  radius(v: number): this;
  intensity(): number;
  intensity(v: number): this;
  color(): string;
  color(v: string): this;
  threshold(): number;
  threshold(v: number): this;
}
