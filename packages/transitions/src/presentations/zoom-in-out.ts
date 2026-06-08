import { glTransition } from "../gl/gl-transition.js";
import type { Presentation } from "../types.js";

// Adapted from https://gl-transitions.com/editor/zoomInOut
// Author: OllyOllyOlly · License: MIT
const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;

in vec2 v_uv;
out vec4 outColor;

vec2 zoom(vec2 uv, float amount) {
	return 0.5 + ((uv - 0.5) * (1.0 - amount));
}

void main() {
	float progress = 1.0 - u_time;
	float zoomFrom = smoothstep(0.0, 1.0, progress * 2.0);
	float zoomTo = smoothstep(0.0, 1.0, (1.0 - progress) * 2.0);
	float crossfade = smoothstep(0.4, 0.6, progress);
	outColor = mix(
		texture(u_prev, zoom(v_uv, zoomFrom)),
		texture(u_next, zoom(v_uv, zoomTo)),
		crossfade
	);
}`;

export type ZoomInOutProps = Record<string, never>;

/** Punch-in / punch-out crossfade (gl-transitions `zoomInOut`). */
export function zoomInOut(): Presentation {
  return glTransition(FRAGMENT);
}
