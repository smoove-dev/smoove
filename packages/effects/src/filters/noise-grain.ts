import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { Effect, type EffectConfig } from "../effect.js";
import { type ParamSchema, paramsToUniforms } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount; // 0..1
uniform float u_size;   // grain cell px
uniform float u_seed;
out vec4 fragColor;
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
	vec4 c = texture(u_texture, v_uv);
	vec2 cell = floor(v_uv * u_resolution / max(u_size, 1.0));
	float n = hash(cell + vec2(u_seed * 0.613, u_seed * 0.377)) - 0.5;
	fragColor = vec4(c.rgb + n * u_amount * c.a, c.a);
}`;

const SCHEMA: ParamSchema = {
  amount: { type: "number", uniform: "u_amount", default: 0.25, min: 0, max: 1, step: 0.01 },
  size: { type: "number", uniform: "u_size", default: 1, min: 1, max: 16, step: 1, px: true },
  animated: { type: "boolean", uniform: null, default: true },
};

export type NoiseGrainConfig = EffectConfig & {
  amount?: number;
  size?: number;
  animated?: boolean;
};

export class NoiseGrainEffect extends Effect {
  constructor(config: NoiseGrainConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }

  override _kmPasses(ctx: EffectFrameContext): EffectPass[] {
    const uniforms = paramsToUniforms(this.schema, this._values, ctx);
    uniforms.u_seed = this._values.animated ? ctx.frame : 0;
    return [{ fragment: FRAGMENT, uniforms }];
  }
}

export interface NoiseGrainEffect {
  amount(): number;
  amount(v: number): this;
  size(): number;
  size(v: number): this;
  animated(): boolean;
  animated(v: boolean): this;
}
