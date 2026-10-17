import Konva from "konva";
import { findClip, findComposition, findSequence } from "../engine/ancestry.js";
import type { KMLayoutNode, LayoutBox } from "./contract.js";
import { clampCorners, normalizeCorners, roundRectPath } from "./corners.js";
import { normalizeEdges, parseSize } from "./flex/engine.js";
import { layoutRoot } from "./flex/flex.js";
import type { EdgeValue, FlexChildProps, FlexProps, SizeValue } from "./flex/types.js";
import { type Measurement, type MeasureOptions, measure as measureNode } from "./measure.js";

export type EdgeColor =
  | string
  | [string, string]
  | [string, string, string, string]
  | { top?: string; right?: string; bottom?: string; left?: string };

export type GradientStop = [number, string];
export type GradientBackground = {
  gradient: {
    type: "linear" | "radial";
    stops: GradientStop[];
    angle?: number;
  };
};
export type BackgroundValue = string | GradientBackground;

export type ShadowProps = {
  color?: string;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
};

export type BlockConfig = Omit<Konva.GroupConfig, "width" | "height"> &
  FlexProps &
  FlexChildProps & {
    width?: SizeValue;
    height?: SizeValue;
    borderSize?: EdgeValue;
    borderColor?: EdgeColor;
    borderStyle?: "solid" | "dashed";
    shadow?: ShadowProps;
    background?: BackgroundValue;
    cornerRadius?: number | number[];
  };

const BLOCK_KEYS = [
  "flexDirection",
  "justifyContent",
  "alignItems",
  "gap",
  "padding",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "margin",
  "borderSize",
  "borderColor",
  "borderStyle",
  "shadow",
  "background",
] as const;

function pickKonvaConfig(config: BlockConfig): Konva.GroupConfig {
  const out: Record<string, unknown> = { ...config };
  for (const k of BLOCK_KEYS) delete out[k];
  const w = parseSize(config.width as SizeValue | undefined);
  const h = parseSize(config.height as SizeValue | undefined);
  out.width = w?.kind === "px" ? w.value : undefined;
  out.height = h?.kind === "px" ? h.value : undefined;
  out.cornerRadius = undefined;
  return out as Konva.GroupConfig;
}

export class Block extends Konva.Group implements KMLayoutNode {
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

  readonly _kmRole = "container" as const;
  private readonly _bg: Konva.Rect;
  /**
   * Border painter, uniform or per-edge — `_bg` never strokes. Hidden while
   * the Block has no border.
   */
  private readonly _border: Konva.Shape;

  constructor(config: BlockConfig) {
    super(pickKonvaConfig(config));

    this._bg = new Konva.Rect({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      listening: false,
      cornerRadius: config.cornerRadius,
    });
    this._bg.setAttr("__blockChrome", true);
    super.add(this._bg);

    this._border = new Konva.Shape({
      listening: false,
      sceneFunc: (ctx) => this._drawBorder(ctx),
    });
    this._border.setAttr("__blockChrome", true);
    this._border.visible(false);
    super.add(this._border);

    this.setAttrs({
      flexDirection: config.flexDirection,
      justifyContent: config.justifyContent,
      alignItems: config.alignItems,
      gap: config.gap,
      padding: config.padding,
      flexGrow: config.flexGrow,
      flexShrink: config.flexShrink,
      flexBasis: config.flexBasis,
      alignSelf: config.alignSelf,
      margin: config.margin,
      borderSize: config.borderSize,
      borderColor: config.borderColor,
      borderStyle: config.borderStyle ?? "solid",
      shadow: config.shadow,
      background: config.background,
      cornerRadius: config.cornerRadius,
      flexWidth: config.width,
      flexHeight: config.height,
    });

    this.on("widthChange heightChange", () => this._layoutBackground());
    this._layoutBackground();
  }

  /**
   * Lay this Block out as a standalone Flexily root, sizing it to its children
   * (hug) or to its explicit width/height, then restyle the background. Called
   * by Sequence each frame for direct-child Blocks; nested Blocks are laid out
   * by their parent Flex instead.
   */
  computeLayout(): void {
    layoutRoot(this, true);
    this._layoutBackground();
  }

  /** @internal — {@link KMLayoutNode}: lay self out as a flex root (Sequence calls this). */
  _kmComputeLayout(): void {
    this.computeLayout();
  }

  /** @internal — {@link KMLayoutNode}: write the computed box back + restyle the background. */
  _kmPlace(box: LayoutBox): void {
    this.x(box.left);
    this.y(box.top);
    this.width(box.width);
    this.height(box.height);
    this._layoutBackground();
  }

  /** Measure this node's stage-space bounds — see {@link measureNode}. */
  measure(opts?: MeasureOptions): Measurement {
    return measureNode(this, opts);
  }

  /** @internal */
  _layoutBackground(): void {
    const w = this.width();
    const h = this.height();
    this._bg.x(0);
    this._bg.y(0);
    this._bg.width(w);
    this._bg.height(h);

    applyBackground(this._bg, this.attrs.background as BackgroundValue | undefined, w, h);
    // The background rect never strokes: borders paint on `_border`, inside the
    // box, so a border can differ per edge and never overhangs its own bounds.
    this._bg.strokeWidth(0);
    this._bg.stroke("");
    this._bg.dashEnabled(false);
    applyShadow(this._bg, this.attrs.shadow as ShadowProps | undefined);
    this._bg.cornerRadius(this.attrs.cornerRadius ?? 0);

    const edges = normalizeEdges(this.attrs.borderSize);
    this._border.x(0);
    this._border.y(0);
    this._border.width(w);
    this._border.height(h);
    this._border.visible(!!edges && edges.some((e) => e > 0) && w > 0 && h > 0);

    // Bottom-most first, so the final order is background, border, content.
    this._border.moveToBottom();
    this._bg.moveToBottom();
  }

  /**
   * @internal Paint the border inside the box, the way CSS does.
   *
   * A uniform border is one stroked rounded rect, inset by half its width so
   * the stroke (which canvas centres on the path) lands wholly inside — that
   * path also keeps dashes working. Edges that differ in width or colour are
   * painted instead as the four CSS trapezoids, joined along the line from each
   * outer corner to its inner corner and clipped to the rounded silhouette.
   */
  private _drawBorder(ctx: Konva.Context): void {
    const w = this.width();
    const h = this.height();
    const edges = normalizeEdges(this.attrs.borderSize);
    if (!edges || w <= 0 || h <= 0) return;
    const [top = 0, right = 0, bottom = 0, left = 0] = edges;
    const colors = normalizeEdgeColors(this.attrs.borderColor as EdgeColor | undefined);
    const radius = clampCorners(normalizeCorners(this.attrs.cornerRadius ?? 0), w, h);
    const uniform =
      top === right &&
      right === bottom &&
      bottom === left &&
      colors[0] === colors[1] &&
      colors[1] === colors[2] &&
      colors[2] === colors[3];

    if (uniform) {
      if (top <= 0) return;
      const inset = top / 2;
      ctx.save();
      roundRectPath(
        ctx,
        inset,
        inset,
        w - top,
        h - top,
        radius.map((r) => Math.max(0, r - inset)),
      );
      ctx.setAttr("strokeStyle", colors[0]);
      ctx.setAttr("lineWidth", top);
      if (this.attrs.borderStyle === "dashed") {
        ctx.setLineDash([Math.max(2, top * 2), Math.max(2, top * 1.5)]);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    roundRectPath(ctx, 0, 0, w, h, radius);
    ctx.clip();
    const fill = (points: number[][], color: string): void => {
      const [first, ...rest] = points;
      if (!first) return;
      ctx.beginPath();
      ctx.moveTo(first[0] ?? 0, first[1] ?? 0);
      for (const p of rest) ctx.lineTo(p[0] ?? 0, p[1] ?? 0);
      ctx.closePath();
      ctx.setAttr("fillStyle", color);
      ctx.fill();
    };
    if (top > 0) {
      fill(
        [
          [0, 0],
          [w, 0],
          [w - right, top],
          [left, top],
        ],
        colors[0] ?? "#000",
      );
    }
    if (right > 0) {
      fill(
        [
          [w, 0],
          [w, h],
          [w - right, h - bottom],
          [w - right, top],
        ],
        colors[1] ?? "#000",
      );
    }
    if (bottom > 0) {
      fill(
        [
          [w, h],
          [0, h],
          [left, h - bottom],
          [w - right, h - bottom],
        ],
        colors[2] ?? "#000",
      );
    }
    if (left > 0) {
      fill(
        [
          [0, h],
          [0, 0],
          [left, top],
          [left, h - bottom],
        ],
        colors[3] ?? "#000",
      );
    }
    ctx.restore();
  }

  /**
   * @internal Testing probe: the paint the background rect actually resolved
   * to, which is not readable from the `Block` node itself because painting
   * happens on an internal child.
   */
  _kmProbePaint():
    | { kind: "color"; color: string }
    | { kind: "gradient"; stops: (number | string)[] }
    | undefined {
    const stops =
      this._bg.fillLinearGradientColorStops() ?? this._bg.fillRadialGradientColorStops();
    if (stops && stops.length > 0) return { kind: "gradient", stops };
    const fill = this._bg.fill();
    return typeof fill === "string" && fill ? { kind: "color", color: fill } : undefined;
  }
}

function applyBackground(
  rect: Konva.Rect,
  bg: BackgroundValue | undefined,
  w: number,
  h: number,
): void {
  // Reset to a truly fill-less state. Konva's hasFill() treats an EMPTY stops
  // array as "has fill" (`!![]`), and a zero-stop gradient paints opaque black
  // under skia-canvas (transparent in browsers) — so clear the attrs to
  // undefined rather than [] or a background-less Block blacks out every
  // layer beneath it in server renders.
  rect.setAttrs({
    fill: undefined,
    fillLinearGradientColorStops: undefined,
    fillRadialGradientColorStops: undefined,
  });
  if (bg === undefined) return;
  if (typeof bg === "string") {
    rect.fill(bg);
    return;
  }
  const g = (bg as GradientBackground).gradient;
  if (!g) return;
  const stops: (number | string)[] = [];
  for (const [pos, color] of g.stops) {
    stops.push(pos, color);
  }
  if (g.type === "linear") {
    const angle = ((g.angle ?? 0) * Math.PI) / 180;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(w, h);
    const dx = (Math.cos(angle) * r) / 2;
    const dy = (Math.sin(angle) * r) / 2;
    rect.fillLinearGradientStartPoint({ x: cx - dx, y: cy - dy });
    rect.fillLinearGradientEndPoint({ x: cx + dx, y: cy + dy });
    rect.fillLinearGradientColorStops(stops);
  } else {
    rect.fillRadialGradientStartPoint({ x: w / 2, y: h / 2 });
    rect.fillRadialGradientEndPoint({ x: w / 2, y: h / 2 });
    rect.fillRadialGradientStartRadius(0);
    rect.fillRadialGradientEndRadius(Math.max(w, h) / 2);
    rect.fillRadialGradientColorStops(stops);
  }
}

/** `borderColor` in any of its accepted forms, as `[top, right, bottom, left]`. */
function normalizeEdgeColors(c: EdgeColor | undefined): [string, string, string, string] {
  const fallback = "#000";
  if (c === undefined) return [fallback, fallback, fallback, fallback];
  if (typeof c === "string") return [c, c, c, c];
  if (Array.isArray(c)) {
    if (c.length === 2) {
      const [v = fallback, hz = fallback] = c;
      return [v, hz, v, hz];
    }
    const [t = fallback, r = fallback, b = fallback, l = fallback] = c;
    return [t, r, b, l];
  }
  // The object form names edges directly; anything omitted falls back to the
  // first colour given, so `{ top: "#f00" }` reads as a red top on black.
  const first = c.top ?? c.right ?? c.bottom ?? c.left ?? fallback;
  return [c.top ?? first, c.right ?? first, c.bottom ?? first, c.left ?? first];
}

function applyShadow(rect: Konva.Rect, shadow: ShadowProps | undefined): void {
  if (!shadow) {
    rect.shadowEnabled(false);
    return;
  }
  rect.shadowEnabled(true);
  if (shadow.color !== undefined) rect.shadowColor(shadow.color);
  if (shadow.blur !== undefined) rect.shadowBlur(shadow.blur);
  if (shadow.offsetX !== undefined || shadow.offsetY !== undefined) {
    rect.shadowOffset({ x: shadow.offsetX ?? 0, y: shadow.offsetY ?? 0 });
  }
  if (shadow.opacity !== undefined) rect.shadowOpacity(shadow.opacity);
}
