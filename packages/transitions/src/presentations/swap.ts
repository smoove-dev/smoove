import { glTransition } from "../gl/gl-transition.js";
import type { Presentation } from "../types.js";

// Adapted from https://gl-transitions.com/editor/swap
// Author: gre - License: MIT
const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_reflection;
uniform float u_perspective;
uniform float u_depth;

in vec2 v_uv;
out vec4 outColor;

const vec4 black = vec4(0.0, 0.0, 0.0, 1.0);
const vec2 boundMin = vec2(0.0, 0.0);
const vec2 boundMax = vec2(1.0, 1.0);

bool inBounds(vec2 p) {
	return all(lessThan(boundMin, p)) && all(lessThan(p, boundMax));
}

vec2 project(vec2 p) {
	return p * vec2(1.0, -1.2) + vec2(0.0, 2.22);
}

vec4 bgColor(vec2 p, vec2 pfr, vec2 pto) {
	vec4 c = black;
	pfr = project(pfr);
	if (inBounds(pfr)) {
		c += mix(black, texture(u_prev, pfr), u_reflection * mix(1.0, 0.0, pfr.y));
	}
	pto = project(pto);
	if (inBounds(pto)) {
		c += mix(black, texture(u_next, pto), u_reflection * mix(1.0, 0.0, pto.y));
	}
	return c;
}

vec4 transition(vec2 p, float progress) {
	vec2 pfr;
	vec2 pto = vec2(-1.0);

	float size = mix(1.0, u_depth, progress);
	float persp = u_perspective * progress;
	pfr = (p + vec2(-0.0, -0.5)) * vec2(
		size / (1.0 - u_perspective * progress),
		size / (1.0 - size * persp * p.x)
	) + vec2(0.0, 0.5);

	size = mix(1.0, u_depth, 1.0 - progress);
	persp = u_perspective * (1.0 - progress);
	pto = (p + vec2(-1.0, -0.5)) * vec2(
		size / (1.0 - u_perspective * (1.0 - progress)),
		size / (1.0 - size * persp * (0.5 - p.x))
	) + vec2(1.0, 0.5);

	if (progress < 0.5) {
		if (inBounds(pfr)) {
			return texture(u_prev, pfr);
		}
		if (inBounds(pto)) {
			return texture(u_next, pto);
		}
	}
	if (inBounds(pto)) {
		return texture(u_next, pto);
	}
	if (inBounds(pfr)) {
		return texture(u_prev, pfr);
	}
	return bgColor(p, pfr, pto);
}

void main() {
	float progress = 1.0 - u_time;
	outColor = transition(v_uv, progress);
}`;

const DEFAULT_REFLECTION = 0.4;
const DEFAULT_PERSPECTIVE = 0.2;
const DEFAULT_DEPTH = 3.0;

export type SwapProps = { reflection?: number; perspective?: number; depth?: number };

/** Perspective card swap with floor reflection (gl-transitions `swap`). */
export function swap(props: SwapProps = {}): Presentation {
  const reflection = props.reflection ?? DEFAULT_REFLECTION;
  const perspective = props.perspective ?? DEFAULT_PERSPECTIVE;
  const depth = props.depth ?? DEFAULT_DEPTH;
  return glTransition(FRAGMENT, () => ({
    u_reflection: reflection,
    u_perspective: perspective,
    u_depth: depth,
  }));
}
