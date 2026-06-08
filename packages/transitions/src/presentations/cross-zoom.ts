import { glTransition } from "../gl/gl-transition.js";
import type { Presentation } from "../types.js";

// Adapted from https://gl-transitions.com/editor/CrossZoom
// Author: rectalogic · License: MIT
const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_strength;

in vec2 v_uv;
out vec4 outColor;

const float PI = 3.141592653589793;

float linearEase(float begin, float change, float duration, float time) {
	return change * time / duration + begin;
}

float exponentialEaseInOut(float begin, float change, float duration, float time) {
	if (time == 0.0) {
		return begin;
	}

	if (time == duration) {
		return begin + change;
	}

	float t = time / (duration / 2.0);
	if (t < 1.0) {
		return change / 2.0 * pow(2.0, 10.0 * (t - 1.0)) + begin;
	}

	return change / 2.0 * (-pow(2.0, -10.0 * (t - 1.0)) + 2.0) + begin;
}

float sinusoidalEaseInOut(float begin, float change, float duration, float time) {
	return -change / 2.0 * (cos(PI * time / duration) - 1.0) + begin;
}

float random(vec2 co) {
	return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec4 crossFade(vec2 uv, float dissolve) {
	return mix(texture(u_prev, uv), texture(u_next, uv), dissolve);
}

vec4 transition(vec2 uv, float progress) {
	vec2 center = vec2(linearEase(0.25, 0.5, 1.0, progress), 0.5);
	float dissolve = exponentialEaseInOut(0.0, 1.0, 1.0, progress);
	float strength = sinusoidalEaseInOut(0.0, u_strength, 0.5, progress);

	vec4 color = vec4(0.0);
	float total = 0.0;
	vec2 toCenter = center - uv;
	float offset = random(uv);

	for (int i = 0; i <= 40; i++) {
		float percent = (float(i) + offset) / 40.0;
		float weight = 4.0 * (percent - percent * percent);
		color += crossFade(uv + toCenter * percent * strength, dissolve) * weight;
		total += weight;
	}

	return color / total;
}

void main() {
	float progress = 1.0 - u_time;
	outColor = transition(v_uv, progress);
}`;

const DEFAULT_STRENGTH = 0.4;

export type CrossZoomProps = { strength?: number };

/** Zoom-blur cross-dissolve (gl-transitions `CrossZoom`). */
export function crossZoom(props: CrossZoomProps = {}): Presentation {
  const strength = props.strength ?? DEFAULT_STRENGTH;
  return glTransition(FRAGMENT, () => ({ u_strength: strength }));
}
