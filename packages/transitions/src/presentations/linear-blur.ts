import { glTransition } from "../gl/gl-transition.js";
import type { Presentation } from "../types.js";

// Adapted from https://gl-transitions.com/editor/LinearBlur
// Author: gre · License: MIT
const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_intensity;

in vec2 v_uv;
out vec4 outColor;

const int PASSES = 6;

vec4 transition(vec2 uv, float progress) {
	vec4 c1 = vec4(0.0);
	vec4 c2 = vec4(0.0);

	float disp = u_intensity * (0.5 - distance(0.5, progress));
	for (int xi = 0; xi < PASSES; xi++) {
		float x = float(xi) / float(PASSES) - 0.5;
		for (int yi = 0; yi < PASSES; yi++) {
			float y = float(yi) / float(PASSES) - 0.5;
			vec2 v = vec2(x, y);
			c1 += texture(u_prev, uv + disp * v);
			c2 += texture(u_next, uv + disp * v);
		}
	}

	c1 /= float(PASSES * PASSES);
	c2 /= float(PASSES * PASSES);
	return mix(c1, c2, progress);
}

void main() {
	float progress = 1.0 - u_time;
	outColor = transition(v_uv, progress);
}`;

const DEFAULT_INTENSITY = 0.1;

export type LinearBlurProps = { intensity?: number };

/** Directionless blur cross-dissolve (gl-transitions `LinearBlur`). */
export function linearBlur(props: LinearBlurProps = {}): Presentation {
  const intensity = props.intensity ?? DEFAULT_INTENSITY;
  return glTransition(FRAGMENT, () => ({ u_intensity: intensity }));
}
