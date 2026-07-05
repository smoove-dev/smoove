import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec4 u_colors[8];
uniform float u_colorsCount;
uniform float u_contour;   // 0 = smooth ramp; N = banded into N steps
uniform float u_angle;     // radians — directional gradient axis
uniform float u_direction; // 0 = pure luminance, 1 = pure directional gradient
uniform float u_offset;    // scrolls the ramp (animatable)
out vec4 fragColor;
void main() {
	vec4 c = texture(u_texture, v_uv);
	vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
	float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
	float axis = dot(v_uv - 0.5, vec2(cos(u_angle), sin(u_angle))) + 0.5;
	float v = fract(mix(lum, axis, u_direction) + u_offset);
	if (u_contour > 0.5) v = floor(v * u_contour) / max(u_contour - 1.0, 1.0);
	float pos = clamp(v, 0.0, 1.0) * (u_colorsCount - 1.0);
	vec3 ramp = u_colors[0].rgb;
	for (int i = 0; i < 7; i++) {
		if (float(i) < u_colorsCount - 1.0) {
			float t = clamp(pos - float(i), 0.0, 1.0);
			ramp = mix(ramp, u_colors[i + 1].rgb, t);
		}
	}
	fragColor = vec4(ramp * c.a, c.a);
}`;

const SCHEMA: ParamSchema = {
  colors: {
    type: "colors",
    uniform: "u_colors",
    default: ["#000428", "#004e92", "#2c7a4b", "#e8e026", "#ff6b08", "#ff0000"],
    max: 8,
  },
  contour: { type: "number", uniform: "u_contour", default: 0, min: 0, max: 32, step: 1 },
  angle: { type: "number", uniform: "u_angle", default: 0, min: 0, max: 360, step: 1, unit: "deg" },
  direction: { type: "number", uniform: "u_direction", default: 0, min: 0, max: 1, step: 0.01 },
  offset: { type: "number", uniform: "u_offset", default: 0, min: -1, max: 1, step: 0.01 },
};

export type HeatmapConfig = EffectConfig & {
  colors?: string[];
  contour?: number;
  angle?: number;
  direction?: number;
  offset?: number;
};

export class HeatmapEffect extends Effect {
  constructor(config: HeatmapConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface HeatmapEffect {
  colors(): string[];
  colors(v: string[]): this;
  contour(): number;
  contour(v: number): this;
  angle(): number;
  angle(v: number): this;
  direction(): number;
  direction(v: number): this;
  offset(): number;
  offset(v: number): this;
}
