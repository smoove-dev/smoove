import type { Node as FlexilyNode } from "flexily/classic";
import type Konva from "konva";
import {
  type AncestryMethods,
  findClip,
  findComposition,
  findSequence,
} from "../../engine/ancestry.js";
import type { KMLayoutNode, LayoutBox } from "../contract.js";
import { type Measurement, type MeasureOptions, measure as measureNode } from "../measure.js";
import { applySize, parseSize } from "./engine.js";
import type { FlexChildProps, SizeValue } from "./types.js";

/** Common shape-config shape: a Konva config plus flex-child props + size values. */
export type LeafConfig = FlexChildProps & {
  width?: SizeValue;
  height?: SizeValue;
} & Record<string, unknown>;

// Keys stripped before handing the config to Konva. width/height are included
// so they're removed when there's no px size: for radius/points shapes Konva
// maps width/height onto geometry, so a leftover `width: undefined` in the
// constructor config would wipe the radius.
const STRIP_KEYS = [
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "margin",
  "width",
  "height",
] as const;

/**
 * Strip smoove-only keys and translate `width`/`height` (which may be a
 * `%` string) into a plain Konva config. Mirrors the per-wrapper
 * `pickKonvaConfig` helpers in `block.ts`/`image.ts`/`video.ts` so leaf shapes
 * don't each re-implement it.
 */
export function pickLeafConfig(config: LeafConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  for (const k of STRIP_KEYS) delete out[k];
  // Only pixel sizes go back to Konva; `%`/hug is resolved later by the engine.
  const w = parseSize(config.width as SizeValue | undefined);
  const h = parseSize(config.height as SizeValue | undefined);
  if (w?.kind === "px") out.width = w.value;
  if (h?.kind === "px") out.height = h.value;
  return out;
}

/** Record flex child props + the original `width`/`height` size values as attrs. */
export function applyLeafFlexAttrs(node: Konva.Node, config: LeafConfig): void {
  node.setAttrs({
    flexGrow: config.flexGrow,
    flexShrink: config.flexShrink,
    flexBasis: config.flexBasis,
    alignSelf: config.alignSelf,
    margin: config.margin,
    flexWidth: config.width,
    flexHeight: config.height,
  });
}

/**
 * Configure a leaf shape's flexily sizing: honor an explicit `px`/`%`
 * width/height, and when neither is given fall back to the shape's intrinsic
 * size (its `getSelfRect()` bounds — diameter for a circle, points-bbox for a
 * line, etc.) as a fixed basis. Using a fixed width/height (rather than a
 * flexily measure callback) keeps the size deterministic — a measure callback
 * isn't reliably consulted for these leaf nodes.
 */
export function leafMeasure(shape: Konva.Shape, node: FlexilyNode): void {
  const w = shape.attrs.flexWidth as SizeValue | undefined;
  const h = shape.attrs.flexHeight as SizeValue | undefined;
  if (w === undefined && h === undefined) {
    const r = shape.getSelfRect();
    if (r.width > 0) node.setWidth(r.width);
    if (r.height > 0) node.setHeight(r.height);
    return;
  }
  applySize(node, w, h);
}

/**
 * Write the computed box back onto a leaf shape. Position is corrected for the
 * shape's origin via `getSelfRect()`: top-left-origin shapes (Rect) have
 * `selfRect.x === 0`, while centered-origin shapes (Circle, Ellipse, Ring,
 * Arc, Wedge, RegularPolygon, Star) have a negative offset, so this lands the
 * shape's *bounding box* at the flex slot. width/height are written through
 * Konva's setters; for radius/points-based shapes those derive geometry, so
 * `flexGrow`-driven stretch can distort them — give such shapes an explicit
 * size (or keep them un-stretched) for predictable results.
 */
export function leafPlace(shape: Konva.Shape, box: LayoutBox): void {
  const r = shape.getSelfRect();
  shape.x(box.left - r.x);
  shape.y(box.top - r.y);
  shape.width(box.width);
  shape.height(box.height);
}

/**
 * Build a smoove leaf wrapper class over a concrete Konva shape. The
 * returned base implements {@link KMLayoutNode} (leaf role + measure + place)
 * and handles config stripping, so a shape wrapper is just:
 *
 * ```ts
 * export class Rect extends FlexShape<Konva.Rect, RectConfig>(Konva.Rect) {}
 * ```
 *
 * The `C` type parameter types the resulting constructor's config, so the
 * subclass needs no body.
 */
export function FlexShape<N extends Konva.Shape, C extends LeafConfig = LeafConfig>(
  // biome-ignore lint/suspicious/noExplicitAny: mixin base accepts any Konva shape constructor.
  Base: new (...args: any[]) => N,
): new (
  config: C,
) => N & KMLayoutNode & AncestryMethods & { measure(opts?: MeasureOptions): Measurement } {
  class Wrapped extends (Base as unknown as new (config?: unknown) => Konva.Shape) {
    readonly _kmRole = "leaf" as const;
    constructor(config: LeafConfig = {}) {
      super(pickLeafConfig(config));
      applyLeafFlexAttrs(this, config);
    }
    _kmMeasure(node: FlexilyNode): void {
      leafMeasure(this, node);
    }
    _kmPlace(box: LayoutBox): void {
      leafPlace(this, box);
    }
    /** Measure this node's stage-space bounds — see {@link measureNode}. */
    measure(opts?: MeasureOptions): Measurement {
      return measureNode(this, opts);
    }
    /** The owning composition, or `null` while detached — like `getStage()`. */
    getComposition(): ReturnType<typeof findComposition> {
      return findComposition(this);
    }
    /** The host sequence (nearest ancestor-or-self layer), or `null`. */
    getSequence(): ReturnType<typeof findSequence> {
      return findSequence(this);
    }
    /** The nearest ancestor-or-self `Clip`, or `null`. */
    getClip(): ReturnType<typeof findClip> {
      return findClip(this);
    }
  }
  return Wrapped as unknown as new (
    config: C,
  ) => N & KMLayoutNode & AncestryMethods & { measure(opts?: MeasureOptions): Measurement };
}
