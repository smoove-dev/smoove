import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { EffectBase } from "./base.js";
import { parseHexColor } from "./color.js";

export type ChromaKeyConfig = {
  /** Key color (hex). Default green-screen green `#00b140`. */
  color?: string;
  /**
   * Chroma-distance radius that keys fully out. Default 45 — keys lit and
   * shadowed screen greens while keeping white (distance ~84 from green)
   * fully opaque.
   */
  similarity?: number;
  /** Soft alpha ramp width past `similarity`. Default 25. */
  smoothness?: number;
};

function chroma(r: number, g: number, b: number): [number, number] {
  // BT.601 CbCr — chroma-only distance is stable across lighting changes.
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return [cb, cr];
}

/**
 * Green-screen keying: one typed-array pass over the node's region. Put it
 * BEFORE blur in the chain (key first, then blur — blurring first smears the
 * key color into the content and the keyer eats the edges).
 */
export class ChromaKeyEffect extends EffectBase {
  private _color: string;
  private _similarity: number;
  private _smoothness: number;
  private _kCb = 0;
  private _kCr = 0;

  constructor(config: ChromaKeyConfig = {}) {
    super();
    this._color = config.color ?? "#00b140";
    this._similarity = config.similarity ?? 45;
    this._smoothness = config.smoothness ?? 25;
    this.recompute();
  }

  private recompute(): void {
    const { r, g, b } = parseHexColor(this._color);
    [this._kCb, this._kCr] = chroma(r, g, b);
  }

  get color(): string {
    return this._color;
  }
  set color(v: string) {
    this._color = v;
    this.recompute();
    this.touch();
  }

  get similarity(): number {
    return this._similarity;
  }
  set similarity(v: number) {
    this._similarity = Math.max(0, v);
    this.touch();
  }

  get smoothness(): number {
    return this._smoothness;
  }
  set smoothness(v: number) {
    this._smoothness = Math.max(0, v);
    this.touch();
  }

  passes(_fc: EffectFrameContext): EffectPass[] {
    const kCb = this._kCb;
    const kCr = this._kCr;
    const sim = this._similarity;
    const smooth = this._smoothness;
    return [
      {
        kind: "pixels",
        key: `chromaKey:${this._color}:${sim}:${smooth}`,
        run: (data) => {
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i] as number;
            const g = data[i + 1] as number;
            const b = data[i + 2] as number;
            const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
            const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
            const dist = Math.sqrt((cb - kCb) ** 2 + (cr - kCr) ** 2);
            if (dist < sim) data[i + 3] = 0;
            else if (smooth > 0 && dist < sim + smooth) {
              data[i + 3] = ((data[i + 3] as number) * (dist - sim)) / smooth;
            }
          }
        },
      },
    ];
  }
}

export function chromaKey(config: ChromaKeyConfig = {}): ChromaKeyEffect {
  return new ChromaKeyEffect(config);
}
