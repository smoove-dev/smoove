import { Effect, type EffectConfig } from "../effect.js";
import type { ParamSchema } from "../params.js";

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_size; // cell size in px
out vec4 fragColor;
void main() {
	vec2 cell = max(u_size, 1.0) / u_resolution;
	vec2 uv = (floor(v_uv / cell) + 0.5) * cell;
	fragColor = texture(u_texture, uv);
}`;

const SCHEMA: ParamSchema = {
  size: { type: "number", uniform: "u_size", default: 8, min: 1, max: 200, step: 1 },
};

export type PixelateConfig = EffectConfig & { size?: number };

export class PixelateEffect extends Effect {
  constructor(config: PixelateConfig = {}) {
    super(SCHEMA, FRAGMENT, config);
  }
}

export interface PixelateEffect {
  size(): number;
  size(v: number): this;
}
