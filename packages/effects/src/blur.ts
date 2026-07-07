import type { EffectFrameContext, EffectPass } from "@smoove/core";
import { Blur as KonvaBlur } from "konva/lib/filters/Blur.js";
import { EffectBase } from "./base.js";
import { supportsCtxFilter } from "./support.js";

export type BlurConfig = {
  /** Blur radius in stage px. Default 8. */
  radius?: number;
};

/** Gaussian blur. Native `ctx.filter` where available; CPU stack blur otherwise. */
export class BlurEffect extends EffectBase {
  private _radius: number;

  constructor(config: BlurConfig = {}) {
    super();
    this._radius = config.radius ?? 8;
  }

  get radius(): number {
    return this._radius;
  }

  set radius(v: number) {
    this._radius = Math.max(0, v);
    this.touch();
  }

  padding(_fc: EffectFrameContext): number {
    return this._radius * 2;
  }

  passes(fc: EffectFrameContext): EffectPass[] {
    const r = Math.round(this._radius * fc.pixelRatio);
    if (r <= 0) return [];
    if (supportsCtxFilter()) {
      return [{ kind: "css", key: `blur:${r}`, filter: `blur(${r}px)` }];
    }
    // CPU fallback (no ctx.filter, e.g. Safari): Konva's stack blur reads
    // `this.blurRadius()` off its filter host — hand it a minimal stand-in.
    return [
      {
        kind: "pixels",
        key: `blur:${r}`,
        run: (data, width, height) => {
          const imageData = { data, width, height } as ImageData;
          const stackBlur = KonvaBlur as unknown as (
            this: { blurRadius(): number },
            id: ImageData,
          ) => void;
          stackBlur.call({ blurRadius: () => r }, imageData);
        },
      },
    ];
  }
}

export function blur(config: BlurConfig = {}): BlurEffect {
  return new BlurEffect(config);
}
