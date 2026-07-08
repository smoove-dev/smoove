import type Konva from "konva";
import type { GlUniforms } from "../gl/platform.js";

/**
 * Frame context handed to {@link SmooveEffect.passes}. All time-like values
 * derive from the composition clock — never wall clock — so server renders
 * are deterministic.
 */
export interface EffectFrameContext {
  frame: number;
  /** `frame / fps`, seconds. */
  time: number;
  fps: number;
  /** Captured region size in device px. */
  width: number;
  height: number;
  pixelRatio: number;
}

/**
 * One unit of Canvas2D (or GL) work an effect contributes this frame.
 * `key` is the pass's parameter fingerprint: two passes with equal keys must
 * produce identical pixels from identical input. The pipeline skips the whole
 * chain and re-blits its cached output when content + every key is unchanged,
 * so time-driven passes must fold their time input into the key.
 */
export type EffectPass =
  | { kind: "css"; key: string; filter: string }
  | {
      kind: "pixels";
      key: string;
      run(data: Uint8ClampedArray, width: number, height: number): void;
    }
  | {
      kind: "composite";
      key: string;
      run(ctx: CanvasRenderingContext2D, fc: EffectFrameContext): void;
    }
  | { kind: "shader"; key: string; fragment: string; uniforms: GlUniforms };

/**
 * The open contract that lets core apply an effect without knowing its
 * implementation. Implemented by `@smoove/effects` presets; anything
 * implementing it can be handed to a node's `effects: [...]` config.
 */
export interface SmooveEffect {
  readonly _fxEffect: true;
  enabled(): boolean;
  /** The passes this effect contributes this frame. */
  passes(fc: EffectFrameContext): EffectPass[];
  /**
   * How many px (stage units) the effect bleeds outside the node's bounding
   * box (blur → 2×radius, water → displacement bleed). Used to inflate the
   * capture region.
   */
  padding?(fc: EffectFrameContext): number;
  /** Bookkeeping so param setters can redraw owning layers. */
  attach(node: Konva.Node): void;
  detach(node: Konva.Node): void;
}

export function isSmooveEffect(v: unknown): v is SmooveEffect {
  return typeof v === "object" && v !== null && (v as Partial<SmooveEffect>)._fxEffect === true;
}

/** Convenience for wrapper config types. */
export type WithEffects<T> = T & { effects?: SmooveEffect[] };
