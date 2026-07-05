import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_amount;   // 0..1 strength
uniform float u_radius;   // 0..1 where falloff starts (center-relative)
uniform float u_softness; // falloff width
uniform vec4 u_color;     // vignette color
out vec4 fragColor;
void main() {
	vec4 c = texture(u_texture, v_uv);
	vec2 p = v_uv - 0.5;
	p.x *= u_resolution.x / u_resolution.y;
	float v = smoothstep(u_radius, u_radius - max(u_softness, 0.0001), length(p));
	float k = mix(1.0, v, u_amount);
	fragColor = vec4(mix(u_color.rgb * c.a, c.rgb, k), c.a);
}`;

const SCHEMA: ParamSchema = {
  amount: { type: "number", uniform: "u_amount", default: 0.6, min: 0, max: 1, step: 0.01 },
  radius: { type: "number", uniform: "u_radius", default: 0.7, min: 0, max: 1.5, step: 0.01 },
  softness: { type: "number", uniform: "u_softness", default: 0.45, min: 0.01, max: 1, step: 0.01 },
  color: { type: "color", uniform: "u_color", default: "#000000" },
};

export type VignetteConfig = EffectConfig & {
  amount?: number;
  radius?: number;
  softness?: number;
  color?: string;
};

export class VignetteEffect extends Effect {
  constructor(config: VignetteConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface VignetteEffect {
  amount(): number;
  amount(v: number): this;
  radius(): number;
  radius(v: number): this;
  softness(): number;
  softness(v: number): this;
  color(): string;
  color(v: string): this;
}
