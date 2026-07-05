import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec4 u_keyColor;
uniform float u_similarity; // 0..1 chroma distance below which pixels are removed
uniform float u_smoothness; // 0..1 soft edge width
uniform float u_spill;      // 0..1 spill-suppression width
out vec4 fragColor;

vec2 rgb2uv(vec3 rgb) {
	return vec2(
		rgb.r * -0.169 + rgb.g * -0.331 + rgb.b * 0.5 + 0.5,
		rgb.r * 0.5 + rgb.g * -0.419 + rgb.b * -0.081 + 0.5
	);
}

void main() {
	vec4 c = texture(u_texture, v_uv);
	vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0); // un-premultiply for keying math
	float dist = distance(rgb2uv(rgb), rgb2uv(u_keyColor.rgb));
	float base = dist - u_similarity;
	float mask = pow(clamp(base / max(u_smoothness, 0.0001), 0.0, 1.0), 1.5);
	float spill = pow(clamp(base / max(u_spill, 0.0001), 0.0, 1.0), 1.5);
	float gray = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
	rgb = mix(vec3(gray), rgb, spill);
	float a = c.a * mask;
	fragColor = vec4(rgb * a, a); // re-premultiply
}`;

const SCHEMA: ParamSchema = {
  color: { type: "color", uniform: "u_keyColor", default: "#00ff00" },
  similarity: {
    type: "number",
    uniform: "u_similarity",
    default: 0.35,
    min: 0,
    max: 1,
    step: 0.01,
  },
  smoothness: {
    type: "number",
    uniform: "u_smoothness",
    default: 0.08,
    min: 0,
    max: 1,
    step: 0.01,
  },
  spill: { type: "number", uniform: "u_spill", default: 0.1, min: 0, max: 1, step: 0.01 },
};

export type ColorKeyConfig = EffectConfig & {
  color?: string;
  similarity?: number;
  smoothness?: number;
  spill?: number;
};

export class ColorKeyEffect extends Effect {
  constructor(config: ColorKeyConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface ColorKeyEffect {
  color(): string;
  color(v: string): this;
  similarity(): number;
  similarity(v: number): this;
  smoothness(): number;
  smoothness(v: number): this;
  spill(): number;
  spill(v: number): this;
}
