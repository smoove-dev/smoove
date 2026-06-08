import { glTransition } from "../gl/gl-transition.js";
import type { Presentation } from "../types.js";

// Adapted from https://gl-transitions.com/editor/dissolve
// Author: hjm1fb · License: MIT
const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_line_width;
uniform vec3 u_spread_color;
uniform vec3 u_hot_color;
uniform float u_pow;
uniform float u_intensity;

in vec2 v_uv;
out vec4 outColor;

vec4 transition(vec2 uv, float progress) {
	vec4 from = texture(u_next, uv);
	vec4 to = texture(u_prev, uv);
	float burn = 0.5 + 0.5 * (0.299 * from.r + 0.587 * from.g + 0.114 * from.b);
	float show = burn - progress;
	if (show < 0.001) {
		return to;
	}
	float factor = 1.0 - smoothstep(0.0, u_line_width, show);
	vec3 burnColor = mix(u_spread_color, u_hot_color, factor);
	burnColor = pow(burnColor, vec3(u_pow)) * u_intensity;
	vec3 finalRGB = mix(from.rgb, burnColor, factor * step(0.0001, progress));
	return vec4(finalRGB, from.a);
}

void main() {
	float progress = u_time;
	outColor = transition(v_uv, progress);
}`;

const DEFAULT_LINE_WIDTH = 0.1;
const DEFAULT_SPREAD_COLOR = "#ff0000";
const DEFAULT_HOT_COLOR = "#e6e633";
const DEFAULT_POW = 5.0;
const DEFAULT_INTENSITY = 1.0;

function parseHexColor(hex: string): [number, number, number] {
  const cleaned = hex.startsWith("#") ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    throw new Error(`dissolve: invalid color "${hex}". Expected a "#rrggbb" hex string.`);
  }
  return [
    Number.parseInt(cleaned.slice(0, 2), 16) / 255,
    Number.parseInt(cleaned.slice(2, 4), 16) / 255,
    Number.parseInt(cleaned.slice(4, 6), 16) / 255,
  ];
}

export type DissolveProps = {
  lineWidth?: number;
  spreadColor?: string;
  hotColor?: string;
  pow?: number;
  intensity?: number;
};

/** Burning cross-dissolve with a glowing edge (gl-transitions `dissolve`). */
export function dissolve(props: DissolveProps = {}): Presentation {
  const lineWidth = props.lineWidth ?? DEFAULT_LINE_WIDTH;
  const spread = parseHexColor(props.spreadColor ?? DEFAULT_SPREAD_COLOR);
  const hot = parseHexColor(props.hotColor ?? DEFAULT_HOT_COLOR);
  const pow = props.pow ?? DEFAULT_POW;
  const intensity = props.intensity ?? DEFAULT_INTENSITY;
  return glTransition(FRAGMENT, () => ({
    u_line_width: lineWidth,
    u_spread_color: spread,
    u_hot_color: hot,
    u_pow: pow,
    u_intensity: intensity,
  }));
}
