import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { EffectBase } from "./base.js";
import { parseHexColor } from "./color.js";

export type ShineConfig = {
  /** Sweep direction in degrees. 0 sweeps left→right. Default 30. */
  angle?: number;
  /** Band width in stage px. Default 120. */
  width?: number;
  /** Band color (hex). Default white. */
  color?: string;
  /** Peak band opacity, 0–1. Default 0.7. */
  intensity?: number;
  /** Sweep position, 0 (band fully off one edge) → 1 (off the other). Animate this. */
  progress?: number;
};

/** A gradient band swept across the node's alpha (`source-atop`) — pure compositing, no pixel access. */
export class ShineEffect extends EffectBase {
  private _angle: number;
  private _width: number;
  private _color: string;
  private _intensity: number;
  private _progress: number;

  constructor(config: ShineConfig = {}) {
    super();
    this._angle = config.angle ?? 30;
    this._width = config.width ?? 120;
    this._color = config.color ?? "#ffffff";
    this._intensity = config.intensity ?? 0.7;
    this._progress = config.progress ?? 0;
  }

  get angle(): number {
    return this._angle;
  }
  set angle(v: number) {
    this._angle = v;
    this.touch();
  }

  get width(): number {
    return this._width;
  }
  set width(v: number) {
    this._width = Math.max(1, v);
    this.touch();
  }

  get color(): string {
    return this._color;
  }
  set color(v: string) {
    this._color = v;
    this.touch();
  }

  get intensity(): number {
    return this._intensity;
  }
  set intensity(v: number) {
    this._intensity = Math.min(1, Math.max(0, v));
    this.touch();
  }

  get progress(): number {
    return this._progress;
  }
  set progress(v: number) {
    this._progress = v;
    this.touch();
  }

  passes(_fc: EffectFrameContext): EffectPass[] {
    const angle = this._angle;
    const width = this._width;
    const color = this._color;
    const intensity = this._intensity;
    const progress = this._progress;
    return [
      {
        kind: "composite",
        key: `shine:${angle}:${width}:${color}:${intensity}:${progress.toFixed(4)}`,
        run: (ctx, fc) => {
          const w = fc.width;
          const h = fc.height;
          const bw = width * fc.pixelRatio;
          const rad = (angle * Math.PI) / 180;
          const ux = Math.cos(rad);
          const uy = Math.sin(rad);
          // Half-extent of the region projected on the sweep axis, plus the
          // band, so progress 0/1 puts the band fully outside the region.
          const half = (Math.abs(ux) * w + Math.abs(uy) * h) / 2 + bw;
          const c = progress * 2 - 1;
          const cx = w / 2 + ux * c * half;
          const cy = h / 2 + uy * c * half;
          const { r, g, b } = parseHexColor(color);
          const grad = ctx.createLinearGradient(
            cx - ux * bw,
            cy - uy * bw,
            cx + ux * bw,
            cy + uy * bw,
          );
          grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
          grad.addColorStop(0.5, `rgba(${r},${g},${b},${intensity})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.save();
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        },
      },
    ];
  }
}

export function shine(config: ShineConfig = {}): ShineEffect {
  return new ShineEffect(config);
}
