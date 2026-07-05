import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

// Holographic-foil sheen: rainbow bands drift across the node's opaque pixels.
// Hue is a function of position along `angle`, the pixel's own luminance (so
// the spectrum bends around glyph strokes the way foil catches light), and the
// composition clock. The sheen screens over the source — premultiplied-safe —
// and `intensity` cross-fades between untouched and fully foiled.
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_angle;      // radians
uniform float u_scale;      // rainbow bands across the node
uniform float u_saturation;
uniform float u_intensity;
uniform float u_time;
out vec4 fragColor;
void main() {
	vec4 src = texture(u_texture, v_uv);
	vec2 dir = vec2(cos(u_angle), sin(u_angle));
	float proj = dot(v_uv - 0.5, dir);
	float lum = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));
	float hue = fract(proj * u_scale + lum * 0.35 + u_time * 0.12);
	vec3 rainbow = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
	rainbow = mix(vec3(1.0), rainbow, u_saturation) * src.a;
	vec3 screened = src.rgb + rainbow * (1.0 - src.rgb);
	fragColor = vec4(mix(src.rgb, screened, u_intensity), src.a);
}`;

const SCHEMA: ParamSchema = {
  intensity: { type: "number", uniform: "u_intensity", default: 0.65, min: 0, max: 1, step: 0.01 },
  scale: { type: "number", uniform: "u_scale", default: 3, min: 0.2, max: 12, step: 0.1 },
  angle: {
    type: "number",
    uniform: "u_angle",
    default: 40,
    min: 0,
    max: 360,
    step: 1,
    unit: "deg",
  },
  saturation: {
    type: "number",
    uniform: "u_saturation",
    default: 1,
    min: 0,
    max: 1,
    step: 0.01,
  },
  speed: { type: "number", uniform: null, default: 1, min: -5, max: 5, step: 0.1 },
};

export type HolographicConfig = EffectConfig & {
  intensity?: number;
  scale?: number;
  angle?: number;
  saturation?: number;
  speed?: number;
};

/** Drifting holographic-foil rainbow sheen over the node's pixels. */
export class HolographicEffect extends Effect {
  constructor(config: HolographicConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface HolographicEffect {
  intensity(): number;
  intensity(v: number): this;
  scale(): number;
  scale(v: number): this;
  angle(): number;
  angle(v: number): this;
  saturation(): number;
  saturation(v: number): this;
  speed(): number;
  speed(v: number): this;
}
