import { glTransition } from "../gl/gl-transition.js";
import type { Presentation } from "../types.js";

// Adapted from https://gl-transitions.com/editor/FilmBurn
// Author: Anastasia Dunbar · License: MIT
const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_seed;

in vec2 v_uv;
out vec4 outColor;

#define PI 3.14159265358979323
#define CLAMPS(x) clamp(x, 0.0, 1.0)
#define REPEATS 50.0

float sigmoid(float x, float a) {
	float b = pow(x * 2.0, a) / 2.0;
	if (x > 0.5) {
		b = 1.0 - pow(2.0 - (x * 2.0), a) / 2.0;
	}
	return b;
}

float rand(float co) {
	return fract(sin((co * 24.9898) + u_seed) * 43758.5453);
}

float rand(vec2 co) {
	return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float apow(float a, float b) {
	return pow(abs(a), b) * sign(b);
}

vec3 pow3(vec3 a, vec3 b) {
	return vec3(apow(a.r, b.r), apow(a.g, b.g), apow(a.b, b.b));
}

float smoothMix(float a, float b, float c) {
	return mix(a, b, sigmoid(c, 2.0));
}

float random(vec2 co, float shft) {
	co += 10.0;
	return smoothMix(
		fract(
			sin(
				dot(
					co.xy,
					vec2(12.9898 + (floor(shft) * 0.5), 78.233 + u_seed)
				)
			) * 43758.5453
		),
		fract(
			sin(
				dot(
					co.xy,
					vec2(12.9898 + (floor(shft + 1.0) * 0.5), 78.233 + u_seed)
				)
			) * 43758.5453
		),
		fract(shft)
	);
}

float smoothRandom(vec2 co, float shft) {
	return smoothMix(
		smoothMix(
			random(floor(co), shft),
			random(floor(co + vec2(1.0, 0.0)), shft),
			fract(co.x)
		),
		smoothMix(
			random(floor(co + vec2(0.0, 1.0)), shft),
			random(floor(co + vec2(1.0, 1.0)), shft),
			fract(co.x)
		),
		fract(co.y)
	);
}

vec4 sampleTexture(vec2 p, float progress) {
	return mix(texture(u_prev, p), texture(u_next, p), sigmoid(progress, 10.0));
}

vec4 transition(vec2 p, float progress) {
	vec3 f = vec3(0.0);
	for (float i = 0.0; i < 13.0; i++) {
		f += sin(((p.x * rand(i) * 6.0) + (progress * 8.0)) + rand(i + 1.43)) *
			sin(
				((p.y * rand(i + 4.4) * 6.0) + (progress * 6.0)) +
					rand(i + 2.4)
			);
		f += 1.0 - CLAMPS(
			length(
				p -
					vec2(
						smoothRandom(vec2(progress * 1.3), i + 1.0),
						smoothRandom(vec2(progress * 0.5), i + 6.25)
					)
			) * mix(20.0, 70.0, rand(i))
		);
	}

	f += 4.0;
	f /= 11.0;
	f = pow3(
		f * vec3(1.0, 0.7, 0.6),
		vec3(1.0, 2.0 - sin(progress * PI), 1.3)
	);
	f *= sin(progress * PI);

	p -= 0.5;
	p *= 1.0 + (smoothRandom(vec2(progress * 5.0), 6.3) * sin(progress * PI) * 0.05);
	p += 0.5;

	vec4 blurredImage = vec4(0.0);
	float blurAmount = sin(progress * PI) * 0.03;
	for (float i = 0.0; i < REPEATS; i++) {
		vec2 q = vec2(
			cos(degrees((i / REPEATS) * 360.0)),
			sin(degrees((i / REPEATS) * 360.0))
		) * (rand(vec2(i, p.x + p.y)) + blurAmount);
		vec2 uv2 = p + (q * blurAmount);
		blurredImage += sampleTexture(uv2, progress);
	}

	blurredImage /= REPEATS;
	return blurredImage + vec4(f, 0.0);
}

void main() {
	float progress = 1.0 - u_time;
	outColor = transition(v_uv, progress);
}`;

const DEFAULT_SEED = 2.31;

export type FilmBurnProps = { seed?: number };

/** Fiery film-burn dissolve (gl-transitions `FilmBurn`). */
export function filmBurn(props: FilmBurnProps = {}): Presentation {
  const seed = props.seed ?? DEFAULT_SEED;
  return glTransition(FRAGMENT, () => ({ u_seed: seed }));
}
