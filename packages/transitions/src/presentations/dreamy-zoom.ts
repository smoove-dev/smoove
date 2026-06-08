import { glTransition } from "../gl/gl-transition.js";
import type { Presentation } from "../types.js";

// Adapted from https://gl-transitions.com/editor/DreamyZoom
// Author: Zeh Fernando · License: MIT
const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_rotation;
uniform float u_scale;
uniform float u_ratio;

in vec2 v_uv;
out vec4 outColor;

const float DEG2RAD = 0.03926990816987241548078304229099;

vec4 transition(vec2 uv, float progress) {
	float phase = progress < 0.5 ? progress * 2.0 : (progress - 0.5) * 2.0;
	float angleOffset = progress < 0.5 ? mix(0.0, u_rotation * DEG2RAD, phase) : mix(-u_rotation * DEG2RAD, 0.0, phase);
	float newScale = progress < 0.5 ? mix(1.0, u_scale, phase) : mix(u_scale, 1.0, phase);

	vec2 center = vec2(0.0, 0.0);
	vec2 p = (uv.xy - vec2(0.5, 0.5)) / newScale * vec2(u_ratio, 1.0);
	float angle = atan(p.y, p.x) + angleOffset;
	float dist = distance(center, p);

	p.x = cos(angle) * dist / u_ratio + 0.5;
	p.y = sin(angle) * dist + 0.5;

	vec4 c = progress < 0.5 ? texture(u_prev, p) : texture(u_next, p);
	return c + (progress < 0.5 ? mix(0.0, 1.0, phase) : mix(1.0, 0.0, phase));
}

void main() {
	float progress = 1.0 - u_time;
	outColor = transition(v_uv, progress);
}`;

const DEFAULT_ROTATION = 6;
const DEFAULT_SCALE = 1.2;

export type DreamyZoomProps = { rotation?: number; scale?: number };

/** Spiralling dreamy zoom (gl-transitions `DreamyZoom`). */
export function dreamyZoom(props: DreamyZoomProps = {}): Presentation {
  const rotation = props.rotation ?? DEFAULT_ROTATION;
  const scale = props.scale ?? DEFAULT_SCALE;
  return glTransition(FRAGMENT, (_p, { width, height }) => ({
    u_rotation: rotation,
    u_scale: scale,
    u_ratio: width / height,
  }));
}
