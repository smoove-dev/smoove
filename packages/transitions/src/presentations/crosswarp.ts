import { glTransition } from "../gl/gl-transition.js";
import type { Presentation } from "../types.js";

// Adapted from https://gl-transitions.com/editor/crosswarp
// Author: Eke Péter · License: MIT
const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;

in vec2 v_uv;
out vec4 outColor;

vec4 transition(vec2 uv, float progress) {
	float x = progress;
	x = smoothstep(0.0, 1.0, x * 2.0 + uv.x - 1.0);
	return mix(
		texture(u_next, (uv - 0.5) * (1.0 - x) + 0.5),
		texture(u_prev, (uv - 0.5) * x + 0.5),
		x
	);
}

void main() {
	float progress = u_time;
	outColor = transition(v_uv, progress);
}`;

export type CrosswarpProps = Record<string, never>;

/** Warping cross-dissolve (gl-transitions `crosswarp`). */
export function crosswarp(): Presentation {
  return glTransition(FRAGMENT);
}
