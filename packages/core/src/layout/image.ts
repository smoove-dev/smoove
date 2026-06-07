import Konva from "konva";
import { parseSize } from "./flex/engine.js";
import type { FlexChildProps, SizeValue } from "./flex/types.js";

export type ObjectFit = "cover" | "contain" | "fill" | "none";
export type ObjectPosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top left"
  | "top right"
  | "bottom left"
  | "bottom right";

export type ImageConfig = Omit<Konva.GroupConfig, "width" | "height"> &
  FlexChildProps & {
    width?: SizeValue;
    height?: SizeValue;
    src: HTMLImageElement | string;
    objectFit?: ObjectFit;
    objectPosition?: ObjectPosition;
    cornerRadius?: number | number[];
  };

const IMG_KEYS = [
  "src",
  "objectFit",
  "objectPosition",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "margin",
] as const;

function pickKonvaConfig(config: ImageConfig): Konva.GroupConfig {
  const out: Record<string, unknown> = { ...config };
  for (const k of IMG_KEYS) delete out[k];
  const w = parseSize(config.width as SizeValue | undefined);
  const h = parseSize(config.height as SizeValue | undefined);
  out.width = w?.kind === "px" ? w.value : undefined;
  out.height = h?.kind === "px" ? h.value : undefined;
  out.cornerRadius = undefined;
  return out as Konva.GroupConfig;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export class Image extends Konva.Group {
  private readonly _img: Konva.Image;
  private _source: HTMLImageElement | null = null;

  constructor(config: ImageConfig) {
    super(pickKonvaConfig(config));

    this._img = new Konva.Image({ image: undefined, listening: false });
    super.add(this._img);

    this.setAttrs({
      flexGrow: config.flexGrow,
      flexShrink: config.flexShrink,
      flexBasis: config.flexBasis,
      alignSelf: config.alignSelf,
      margin: config.margin,
      objectFit: config.objectFit ?? "cover",
      objectPosition: config.objectPosition ?? "center",
      cornerRadius: config.cornerRadius,
      flexWidth: config.width,
      flexHeight: config.height,
    });

    if (config.cornerRadius !== undefined) {
      const cr = normalizeCorners(config.cornerRadius);
      this.clipFunc((ctx) => roundRectPath(ctx, 0, 0, this.width(), this.height(), cr));
    }

    this.on("widthChange heightChange", () => this._layoutImage());

    if (typeof config.src === "string") {
      loadImage(config.src).then((img) => {
        this._source = img;
        this._img.image(img);
        this._layoutImage();
        this.getLayer()?.batchDraw();
      });
    } else {
      this._source = config.src;
      this._img.image(config.src);
    }

    this._layoutImage();
  }

  /** @internal */
  _layoutImage(): void {
    const w = this.width();
    const h = this.height();
    if (w <= 0 || h <= 0) return;
    const src = this._source;
    const fit = (this.attrs.objectFit ?? "cover") as ObjectFit;
    const pos = (this.attrs.objectPosition ?? "center") as ObjectPosition;
    if (!src || src.naturalWidth === 0 || src.naturalHeight === 0) return;
    const nw = src.naturalWidth;
    const nh = src.naturalHeight;

    if (fit === "fill") {
      this._img.position({ x: 0, y: 0 });
      this._img.size({ width: w, height: h });
      this._img.crop({ x: 0, y: 0, width: nw, height: nh });
      return;
    }
    if (fit === "none") {
      const { x, y } = positionOffset(pos, w - nw, h - nh);
      this._img.position({ x, y });
      this._img.size({ width: nw, height: nh });
      this._img.crop({ x: 0, y: 0, width: nw, height: nh });
      return;
    }
    if (fit === "contain") {
      const scale = Math.min(w / nw, h / nh);
      const dw = nw * scale;
      const dh = nh * scale;
      const { x, y } = positionOffset(pos, w - dw, h - dh);
      this._img.position({ x, y });
      this._img.size({ width: dw, height: dh });
      this._img.crop({ x: 0, y: 0, width: nw, height: nh });
      return;
    }
    const scale = Math.max(w / nw, h / nh);
    const cropW = w / scale;
    const cropH = h / scale;
    const { x: cx, y: cy } = positionOffset(pos, nw - cropW, nh - cropH);
    this._img.position({ x: 0, y: 0 });
    this._img.size({ width: w, height: h });
    this._img.crop({ x: cx, y: cy, width: cropW, height: cropH });
  }
}

function positionOffset(
  pos: ObjectPosition,
  freeX: number,
  freeY: number,
): { x: number; y: number } {
  let fx = 0.5;
  let fy = 0.5;
  if (pos.includes("left")) fx = 0;
  else if (pos.includes("right")) fx = 1;
  if (pos.includes("top")) fy = 0;
  else if (pos.includes("bottom")) fy = 1;
  if (pos === "center") {
    fx = 0.5;
    fy = 0.5;
  }
  return { x: freeX * fx, y: freeY * fy };
}

function normalizeCorners(c: number | number[]): number[] {
  if (typeof c === "number") return [c, c, c, c];
  if (c.length === 1) return [c[0] ?? 0, c[0] ?? 0, c[0] ?? 0, c[0] ?? 0];
  if (c.length === 2) return [c[0] ?? 0, c[1] ?? 0, c[0] ?? 0, c[1] ?? 0];
  return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 0];
}

function roundRectPath(
  ctx: Konva.Context | CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number[],
): void {
  const [tl, tr, br, bl] = r;
  ctx.beginPath();
  ctx.moveTo(x + (tl ?? 0), y);
  ctx.lineTo(x + w - (tr ?? 0), y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + (tr ?? 0));
  ctx.lineTo(x + w, y + h - (br ?? 0));
  ctx.quadraticCurveTo(x + w, y + h, x + w - (br ?? 0), y + h);
  ctx.lineTo(x + (bl ?? 0), y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - (bl ?? 0));
  ctx.lineTo(x, y + (tl ?? 0));
  ctx.quadraticCurveTo(x, y, x + (tl ?? 0), y);
  ctx.closePath();
}
