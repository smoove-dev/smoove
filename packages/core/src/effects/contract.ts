import type Konva from "konva";
import type { GlUniforms } from "../gl/types.js";

/** An axis-aligned rectangle in device px. */
export type EffectRect = { x: number; y: number; width: number; height: number };

/**
 * Frame state handed to an effect each time it is asked for its passes.
 *
 * `time` is derived from the frame clock (`frame / fps`), never from the wall
 * clock. That is the whole reason effects are seekable: rendering frame 900
 * cold produces the same pixels as playing to it.
 */
export interface EffectFrameContext {
  frame: number;
  /** `frame / fps`, in seconds. */
  time: number;
  fps: number;
  /** Captured region width, device px. */
  width: number;
  /** Captured region height, device px. */
  height: number;
  /**
   * The node's own bounding box inside the captured region — device px, origin
   * at the region's top-left, y growing downward.
   *
   * The region is the box plus per-side padding, snapped to a bucket, so an
   * effect that shapes itself analytically (a rounded box, a rim, a gradient
   * anchored to an edge) cannot recover the box from `width`/`height` alone.
   */
  contentRect: EffectRect;
  pixelRatio: number;
  /** The node being drawn — a cache key for anything derived from its content. */
  node: Konva.Node;
  /**
   * Bumps whenever the node's subtree changes its pixels. An effect that
   * precomputes something expensive from the capture (a distance field, an
   * outline) caches it against this and skips the rebuild while it holds.
   */
  contentVersion: number;
}

/**
 * How far an effect bleeds past its node's bounding box, in CSS px.
 *
 * Per-side rather than a single scalar because directional effects are the
 * common case: fire reaching 170px upward but 8px sideways would otherwise pad
 * a 200x40 title to 540x380 and shade mostly-transparent pixels every frame.
 */
export type EffectPadding = number | { top: number; right: number; bottom: number; left: number };

export type EffectPaddingBox = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/**
 * One unit of work in an effect chain.
 *
 * - `css` — a `ctx.filter` fragment. Consecutive ones join into a single
 *   filter string and one `drawImage`.
 * - `pixels` — a typed-array pass. Consecutive ones share one
 *   `getImageData`/`putImageData` round trip.
 * - `composite` — draws directly on the working canvas; no pixel access.
 * - `shader` — a fragment run through the shared GL bridge. `textures`
 *   supplies extra sources bound after the working canvas (e.g. an SDF).
 */
export type EffectPass =
  | { kind: "css"; filter: string }
  | { kind: "pixels"; run(data: Uint8ClampedArray, w: number, h: number): void }
  | { kind: "composite"; run(ctx: CanvasRenderingContext2D, fc: EffectFrameContext): void }
  | {
      kind: "shader";
      fragment: string;
      uniforms: GlUniforms;
      /**
       * Extra sources bound after the working canvas, as `u_tex1`, `u_tex2`, ...
       * `source` is the working canvas itself (bound as `u_tex0`), so a pass can
       * derive a texture from the captured content.
       */
      textures?(
        fc: EffectFrameContext,
        source: HTMLCanvasElement | OffscreenCanvas,
      ): (HTMLCanvasElement | OffscreenCanvas)[];
    };

/**
 * A post-process applied to a node, group or Sequence. Implementations are
 * small mutable objects: setting a param invalidates the owning node's chain,
 * and animation is a plain assignment in a frame callback.
 */
export interface SmooveEffect {
  readonly _fxEffect: true;
  /** `false` skips this effect entirely for the current frame. */
  enabled(): boolean;
  passes(fc: EffectFrameContext): EffectPass[];
  padding?(fc: EffectFrameContext): EffectPadding;
  /** Called when the effect joins a node's chain, so param sets can invalidate. */
  attach(node: Konva.Node): void;
  detach(node: Konva.Node): void;
}

export function isSmooveEffect(value: unknown): value is SmooveEffect {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value) && "_fxEffect" in value
  );
}

export function normalizePadding(p: EffectPadding | undefined): EffectPaddingBox {
  if (p === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  return p;
}

/** Per-side maximum across a chain's paddings — the region every effect fits in. */
export function maxPadding(boxes: readonly EffectPaddingBox[]): EffectPaddingBox {
  const out = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const b of boxes) {
    if (b.top > out.top) out.top = b.top;
    if (b.right > out.right) out.right = b.right;
    if (b.bottom > out.bottom) out.bottom = b.bottom;
    if (b.left > out.left) out.left = b.left;
  }
  return out;
}
