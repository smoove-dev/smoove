import { glTransition } from "../gl/gl-transition.js";
import type { Presentation } from "../types.js";

// Adapted from https://gl-transitions.com/editor/BookFlip
// Author: hong · License: MIT
const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_direction;

in vec2 v_uv;
out vec4 outColor;

const float EPSILON = 0.0001;

float avoidZero(float value) {
	if (abs(value) < EPSILON) {
		return value < 0.0 ? -EPSILON : EPSILON;
	}

	return value;
}

vec2 skewRight(vec2 p, float progress) {
	float skewX = (p.x - progress) / avoidZero(0.5 - progress) * 0.5;
	float skewY =
		(p.y - 0.5) /
			avoidZero(0.5 + progress * (p.x - 0.5) / 0.5) *
			0.5 +
		0.5;
	return vec2(skewX, skewY);
}

vec2 skewLeft(vec2 p, float progress) {
	float skewX = (p.x - 0.5) / avoidZero(progress - 0.5) * 0.5 + 0.5;
	float skewY =
		(p.y - 0.5) /
			avoidZero(0.5 + (1.0 - progress) * (0.5 - p.x) / 0.5) *
			0.5 +
		0.5;
	return vec2(skewX, skewY);
}

vec4 addShade(float progress) {
	float shadeVal = max(0.7, abs(progress - 0.5) * 2.0);
	return vec4(vec3(shadeVal), 1.0);
}

vec2 toCanonicalUv(vec2 p) {
	if (u_direction < 0.5) {
		return p;
	}

	if (u_direction < 1.5) {
		return vec2(1.0 - p.x, p.y);
	}

	if (u_direction < 2.5) {
		return vec2(p.y, 1.0 - p.x);
	}

	return vec2(1.0 - p.y, p.x);
}

vec2 fromCanonicalUv(vec2 p) {
	if (u_direction < 0.5) {
		return p;
	}

	if (u_direction < 1.5) {
		return vec2(1.0 - p.x, p.y);
	}

	if (u_direction < 2.5) {
		return vec2(1.0 - p.y, p.x);
	}

	return vec2(p.y, 1.0 - p.x);
}

vec4 samplePrev(vec2 p) {
	return texture(u_prev, fromCanonicalUv(p));
}

vec4 sampleNext(vec2 p) {
	return texture(u_next, fromCanonicalUv(p));
}

vec4 transition(vec2 p, float progress) {
	float pr = step(1.0 - progress, p.x);

	if (p.x < 0.5) {
		return mix(
			samplePrev(p),
			sampleNext(skewLeft(p, progress)) * addShade(progress),
			pr
		);
	}

	return mix(
		samplePrev(skewRight(p, progress)) * addShade(progress),
		sampleNext(p),
		pr
	);
}

void main() {
	vec2 p = toCanonicalUv(v_uv);
	float progress = 1.0 - u_time;
	outColor = transition(p, progress);
}`;

export type BookFlipDirection = "from-left" | "from-right" | "from-top" | "from-bottom";

export type BookFlipProps = { direction?: BookFlipDirection };

const DIRECTION_CONSTANT: Record<BookFlipDirection, number> = {
  "from-left": 0,
  "from-right": 1,
  "from-top": 2,
  "from-bottom": 3,
};

/** Page-turn / book flip (gl-transitions `BookFlip`). */
export function bookFlip(props: BookFlipProps = {}): Presentation {
  const direction = props.direction ?? "from-right";
  return glTransition(FRAGMENT, () => ({ u_direction: DIRECTION_CONSTANT[direction] }));
}
