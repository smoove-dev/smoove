import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount; // px offset
uniform float u_angle;  // radians
out vec4 fragColor;
void main() {
	vec2 off = vec2(cos(u_angle), sin(u_angle)) * u_amount / u_resolution;
	vec4 g = texture(u_texture, v_uv);
	float r = texture(u_texture, v_uv + off).r;
	float b = texture(u_texture, v_uv - off).b;
	fragColor = vec4(r, g.g, b, g.a);
}`;

const SCHEMA: ParamSchema = {
  amount: { type: "number", uniform: "u_amount", default: 4, min: 0, max: 60, step: 0.5 },
  angle: { type: "number", uniform: "u_angle", default: 0, min: 0, max: 360, step: 1, unit: "deg" },
};

export type ChromaticAberrationConfig = EffectConfig & { amount?: number; angle?: number };

export class ChromaticAberrationEffect extends Effect {
  constructor(config: ChromaticAberrationConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface ChromaticAberrationEffect {
  amount(): number;
  amount(v: number): this;
  angle(): number;
  angle(v: number): this;
}
