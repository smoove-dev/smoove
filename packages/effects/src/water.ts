import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { EffectBase } from "./base.js";
import { parseColorVec4 } from "./color.js";
import { waterFragmentShader } from "./glsl/water.js";

export type WaterConfig = {
  /** Backdrop color behind the distorted pixels (hex, default transparent). */
  colorBack?: string;
  /** Highlight tint (hex). Default white. */
  colorHighlight?: string;
  /** Highlight amount, 0–1. Default 0.07. */
  highlights?: number;
  /** Layered-wave mix, 0–1. Default 0.5. */
  layering?: number;
  /** Edge distortion, 0–1. Default 0.8. */
  edges?: number;
  /** Wave strength, 0–1. Default 0.3. */
  waves?: number;
  /** Caustic strength, 0–1. Default 0.1. */
  caustic?: number;
  /** Pattern scale. Default 1. */
  size?: number;
  /** Time multiplier. Default 1. */
  speed?: number;
};

/**
 * Caustic water-surface distortion over the node's pixels (fragment derived
 * from paper-design/shaders, see NOTICE). Needs a GL platform; where none is
 * available the pass is skipped and the node draws undistorted.
 */
export class WaterEffect extends EffectBase {
  private _colorBack: string;
  private _colorHighlight: string;
  private _highlights: number;
  private _layering: number;
  private _edges: number;
  private _waves: number;
  private _caustic: number;
  private _size: number;
  private _speed: number;

  constructor(config: WaterConfig = {}) {
    super();
    this._colorBack = config.colorBack ?? "#00000000";
    this._colorHighlight = config.colorHighlight ?? "#ffffff";
    this._highlights = config.highlights ?? 0.07;
    this._layering = config.layering ?? 0.5;
    this._edges = config.edges ?? 0.8;
    this._waves = config.waves ?? 0.3;
    this._caustic = config.caustic ?? 0.1;
    this._size = config.size ?? 1;
    this._speed = config.speed ?? 1;
  }

  get colorBack(): string {
    return this._colorBack;
  }
  set colorBack(v: string) {
    this._colorBack = v;
    this.touch();
  }
  get colorHighlight(): string {
    return this._colorHighlight;
  }
  set colorHighlight(v: string) {
    this._colorHighlight = v;
    this.touch();
  }
  get highlights(): number {
    return this._highlights;
  }
  set highlights(v: number) {
    this._highlights = v;
    this.touch();
  }
  get layering(): number {
    return this._layering;
  }
  set layering(v: number) {
    this._layering = v;
    this.touch();
  }
  get edges(): number {
    return this._edges;
  }
  set edges(v: number) {
    this._edges = v;
    this.touch();
  }
  get waves(): number {
    return this._waves;
  }
  set waves(v: number) {
    this._waves = v;
    this.touch();
  }
  get caustic(): number {
    return this._caustic;
  }
  set caustic(v: number) {
    this._caustic = v;
    this.touch();
  }
  get size(): number {
    return this._size;
  }
  set size(v: number) {
    this._size = v;
    this.touch();
  }
  get speed(): number {
    return this._speed;
  }
  set speed(v: number) {
    this._speed = v;
    this.touch();
  }

  /** The caustic displacement pulls edge pixels outward — conservative fixed bleed. */
  padding(_fc: EffectFrameContext): number {
    return 40;
  }

  passes(fc: EffectFrameContext): EffectPass[] {
    const uniforms = {
      u_time: fc.time * this._speed,
      u_colorBack: parseColorVec4(this._colorBack),
      u_colorHighlight: parseColorVec4(this._colorHighlight),
      u_highlights: this._highlights,
      u_layering: this._layering,
      u_edges: this._edges,
      u_waves: this._waves,
      u_caustic: this._caustic,
      u_size: this._size,
    };
    return [
      {
        kind: "shader",
        key: `water:${JSON.stringify(uniforms)}`,
        fragment: waterFragmentShader,
        uniforms,
      },
    ];
  }
}

export function water(config: WaterConfig = {}): WaterEffect {
  return new WaterEffect(config);
}
