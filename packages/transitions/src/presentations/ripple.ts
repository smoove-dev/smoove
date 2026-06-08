import { glTransition } from "../gl/gl-transition.js";
import type { Presentation } from "../types.js";

// Adapted from https://gl-transitions.com/editor/ripple
// Author: gre · License: MIT
const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_amplitude;
uniform float u_speed;

in vec2 v_uv;
out vec4 outColor;

vec4 transition(vec2 uv, float progress) {
	vec2 dir = uv - vec2(0.5);
	float dist = length(dir);
	vec2 offset = dir * (sin(progress * dist * u_amplitude - progress * u_speed) + 0.5) / 30.0 * progress;
	return mix(
		texture(u_next, uv + offset),
		texture(u_prev, uv),
		smoothstep(0.2, 1.0, progress)
	);
}

void main() {
	float progress = u_time;
	outColor = transition(v_uv, progress);
}`;

const DEFAULT_AMPLITUDE = 100.0;
const DEFAULT_SPEED = 50.0;

export type RippleProps = { amplitude?: number; speed?: number };

/** Concentric ripple cross-dissolve (gl-transitions `ripple`). */
export function ripple(props: RippleProps = {}): Presentation {
  const amplitude = props.amplitude ?? DEFAULT_AMPLITUDE;
  const speed = props.speed ?? DEFAULT_SPEED;
  return glTransition(FRAGMENT, () => ({ u_amplitude: amplitude, u_speed: speed }));
}
