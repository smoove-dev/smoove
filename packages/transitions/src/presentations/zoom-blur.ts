import { glTransition } from "../gl/gl-transition.js";
import type { Presentation } from "../types.js";

// Symmetric counter-rotating zoom blur. Remotion-original shader.
const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_aspect;
uniform float u_max_angle;

in vec2 v_uv;
out vec4 outColor;

const int SAMPLES = 16;
const float STRENGTH = 0.35;

vec2 transformUV(vec2 uv, float angle, float scale) {
	vec2 p = uv - 0.5;
	p.x *= u_aspect;
	p /= scale;
	float c = cos(-angle);
	float s = sin(-angle);
	p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
	p.x /= u_aspect;
	return p + 0.5;
}

float coverScale(float angle) {
	float c = abs(cos(angle));
	float s = abs(sin(angle));
	float ar = max(u_aspect, 1.0 / u_aspect);
	return c + ar * s;
}

vec4 zoomBlur(sampler2D tex, vec2 uv, float strength) {
	vec2 dir = uv - 0.5;
	vec4 acc = vec4(0.0);
	for (int i = 0; i < SAMPLES; i++) {
		float t = float(i) / float(SAMPLES - 1);
		float scale = 1.0 - strength * t;
		acc += texture(tex, 0.5 + dir * scale);
	}
	return acc / float(SAMPLES);
}

void main() {
	float mixT = u_time;

	float nextAngle = u_max_angle * mixT;
	float prevAngle = -u_max_angle * (1.0 - mixT);

	vec2 prevUV = transformUV(v_uv, prevAngle, coverScale(prevAngle));
	vec2 nextUV = transformUV(v_uv, nextAngle, coverScale(nextAngle));

	vec4 prev = zoomBlur(u_prev, prevUV, STRENGTH * (1.0 - mixT));
	vec4 next = zoomBlur(u_next, nextUV, STRENGTH * mixT);
	outColor = mix(prev, next, (1.0 - mixT));
}`;

const DEFAULT_ROTATION = Math.PI / 6;

export type ZoomBlurProps = { rotation?: number };

/** Counter-rotating radial zoom blur (Remotion-original `zoomBlur`). */
export function zoomBlur(props: ZoomBlurProps = {}): Presentation {
  const rotation = props.rotation ?? DEFAULT_ROTATION;
  return glTransition(FRAGMENT, (_p, { width, height }) => ({
    u_aspect: width / height,
    u_max_angle: rotation,
  }));
}
