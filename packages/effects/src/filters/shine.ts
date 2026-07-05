import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

// A specular gloss band sweeping across the node's opaque pixels — the classic
// logo/text shine. The band travels along `angle` once per `period` seconds
// (composition clock, so scrubbing and server renders match), with a soft
// gaussian body plus a tighter hot core so it reads as a streak of light.
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_angle;     // radians
uniform float u_width;     // gaussian half-width in projected uv units
uniform float u_intensity;
uniform vec4 u_color;
uniform float u_period;    // seconds per sweep
uniform float u_time;
out vec4 fragColor;
void main() {
	vec4 src = texture(u_texture, v_uv);
	vec2 dir = vec2(cos(u_angle), sin(u_angle));
	float proj = dot(v_uv - 0.5, dir);
	float t = fract(u_time / u_period);
	float reach = 0.75 + u_width * 3.0; // start/end fully off the node
	float d = abs(proj - mix(-reach, reach, t));
	float body = exp(-d * d / (2.0 * u_width * u_width));
	float hot = u_width * 0.35;
	float core = exp(-d * d / (2.0 * hot * hot));
	float shine = (0.55 * body + core) * u_intensity * src.a;
	fragColor = vec4(src.rgb + u_color.rgb * u_color.a * shine, src.a);
}`;

const SCHEMA: ParamSchema = {
  color: { type: "color", uniform: "u_color", default: "#ffffff" },
  intensity: { type: "number", uniform: "u_intensity", default: 1, min: 0, max: 3, step: 0.05 },
  width: { type: "number", uniform: "u_width", default: 0.08, min: 0.01, max: 0.5, step: 0.01 },
  angle: {
    type: "number",
    uniform: "u_angle",
    default: 65,
    min: 0,
    max: 360,
    step: 1,
    unit: "deg",
  },
  period: { type: "number", uniform: "u_period", default: 2.5, min: 0.2, max: 10, step: 0.1 },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type ShineConfig = EffectConfig & {
  color?: string;
  intensity?: number;
  width?: number;
  angle?: number;
  period?: number;
  speed?: number;
};

/** A sweeping specular gloss band — the classic logo/text shine. */
export class ShineEffect extends Effect {
  constructor(config: ShineConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface ShineEffect {
  color(): string;
  color(v: string): this;
  intensity(): number;
  intensity(v: number): this;
  width(): number;
  width(v: number): this;
  angle(): number;
  angle(v: number): this;
  period(): number;
  period(v: number): this;
  speed(): number;
  speed(v: number): this;
}
