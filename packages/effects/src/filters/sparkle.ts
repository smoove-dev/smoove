import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

// Twinkling star glints pinned to the node's opaque pixels. The canvas is cut
// into a hashed grid (`density` cells across the long edge); each cell hosts
// one glint with its own position, size and twinkle phase. A pixel gathers the
// 3×3 neighborhood so glints cross cell borders without seams. Glints only
// light up where the node has alpha (sampled at the glint center), and the
// pow()ed sine envelope keeps each one dark most of the time — a twinkle, not
// a steady lamp.
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_density;   // grid cells across the long edge
uniform float u_size;      // base glint radius in px
uniform vec4 u_color;
uniform float u_intensity;
uniform float u_time;
out vec4 fragColor;

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

void main() {
	vec4 src = texture(u_texture, v_uv);
	vec2 px = v_uv * u_resolution;
	float cellSize = max(u_resolution.x, u_resolution.y) / u_density;
	vec2 cell = floor(px / cellSize);
	float glint = 0.0;
	for (int dx = -1; dx <= 1; dx++) {
		for (int dy = -1; dy <= 1; dy++) {
			vec2 c = cell + vec2(float(dx), float(dy));
			float h = hash21(c);
			vec2 jitter = vec2(hash21(c + 17.0), hash21(c + 31.0));
			vec2 center = (c + 0.1 + jitter * 0.8) * cellSize;
			float mask = texture(u_texture, center / u_resolution).a;
			if (mask < 0.01) continue;
			float tw = 0.5 + 0.5 * sin(6.2831 * (u_time * (0.4 + 0.6 * h) + h * 7.0));
			tw = pow(tw, 6.0);
			vec2 d = px - center;
			float r = u_size * (0.6 + 0.8 * h);
			float dot2 = exp(-dot(d, d) / (r * r));
			float spikes = exp(-abs(d.x * d.y) / (r * 0.75)) * exp(-dot(d, d) / (r * r * 16.0));
			glint += (dot2 + spikes) * tw * mask;
		}
	}
	glint *= u_intensity;
	float a = clamp(src.a + glint * u_color.a, 0.0, 1.0);
	fragColor = vec4(src.rgb + u_color.rgb * u_color.a * glint, a);
}`;

const SCHEMA: ParamSchema = {
  color: { type: "color", uniform: "u_color", default: "#ffffff" },
  intensity: { type: "number", uniform: "u_intensity", default: 1, min: 0, max: 3, step: 0.05 },
  density: { type: "number", uniform: "u_density", default: 14, min: 2, max: 40, step: 1 },
  size: { type: "number", uniform: "u_size", default: 4, min: 1, max: 20, step: 0.5, px: true },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type SparkleConfig = EffectConfig & {
  color?: string;
  intensity?: number;
  density?: number;
  size?: number;
  speed?: number;
};

/** Twinkling star glints scattered over the node's opaque pixels. */
export class SparkleEffect extends Effect {
  constructor(config: SparkleConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface SparkleEffect {
  color(): string;
  color(v: string): this;
  intensity(): number;
  intensity(v: number): this;
  density(): number;
  density(v: number): this;
  size(): number;
  size(v: number): this;
  speed(): number;
  speed(v: number): this;
}
