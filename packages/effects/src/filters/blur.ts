import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { Effect, type EffectConfig } from "../effect.js";
import { type ParamSchema, paramsToUniforms } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_direction; // (radius, 0) or (0, radius) in px
out vec4 fragColor;
void main() {
	vec2 step = u_direction / u_resolution;
	vec4 acc = vec4(0.0);
	float total = 0.0;
	for (int i = -7; i <= 7; i++) {
		float t = float(i) / 7.0;
		float w = exp(-t * t * 3.0);
		acc += texture(u_texture, v_uv + step * t) * w;
		total += w;
	}
	fragColor = acc / total;
}`;

const SCHEMA: ParamSchema = {
  radius: { type: "number", uniform: null, default: 10, min: 0, max: 100, step: 1 },
  horizontal: { type: "boolean", uniform: null, default: true },
  vertical: { type: "boolean", uniform: null, default: true },
};

export type BlurConfig = EffectConfig & {
  radius?: number;
  horizontal?: boolean;
  vertical?: boolean;
};

export class BlurEffect extends Effect {
  constructor(config: BlurConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }

  override _kmPadding(_ctx: EffectFrameContext): number {
    return this._values.radius as number;
  }

  override _kmPasses(ctx: EffectFrameContext): EffectPass[] {
    const base = paramsToUniforms(this.schema, this._values, ctx);
    const r = (this._values.radius as number) * ctx.pixelRatio;
    const passes: EffectPass[] = [];
    if (r <= 0) return passes;
    if (this._values.horizontal) {
      passes.push({ fragment: FRAGMENT, uniforms: { ...base, u_direction: [r, 0] } });
    }
    if (this._values.vertical) {
      passes.push({ fragment: FRAGMENT, uniforms: { ...base, u_direction: [0, r] } });
    }
    return passes;
  }
}

export interface BlurEffect {
  radius(): number;
  radius(v: number): this;
  horizontal(): boolean;
  horizontal(v: boolean): this;
  vertical(): boolean;
  vertical(v: boolean): this;
}
