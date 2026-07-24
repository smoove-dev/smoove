import Konva from "konva";
import { findClip, findComposition, findSequence } from "../engine/ancestry.js";
import type { KMLayoutNode, LayoutBox } from "./contract.js";
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

function firstColor(c: EdgeColor | undefined): string | undefined {
  if (c === undefined) return undefined;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c[0];
  return c.top ?? c.right ?? c.bottom ?? c.left;
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
    this._bg.setAttr("__blockBg", true);
    super.add(this._bg);

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
    applyBorder(
      this._bg,
      normalizeEdges(this.attrs.borderSize),
      this.attrs.borderColor as EdgeColor | undefined,
      this.attrs.borderStyle as "solid" | "dashed" | undefined,
    );
    applyShadow(this._bg, this.attrs.shadow as ShadowProps | undefined);
    this._bg.cornerRadius(this.attrs.cornerRadius ?? 0);
    this._bg.moveToBottom();
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

function applyBorder(
  rect: Konva.Rect,
  edges: [number, number, number, number] | null,
  color: EdgeColor | undefined,
  style: "solid" | "dashed" | undefined,
): void {
  if (!edges) {
    rect.strokeWidth(0);
    rect.stroke("");
    rect.dashEnabled(false);
    return;
  }
  const width = Math.max(...edges);
  rect.strokeWidth(width);
  rect.stroke(firstColor(color) ?? "#000");
  if (style === "dashed") {
    rect.dash([Math.max(2, width * 2), Math.max(2, width * 1.5)]);
    rect.dashEnabled(true);
  } else {
    rect.dashEnabled(false);
  }
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
