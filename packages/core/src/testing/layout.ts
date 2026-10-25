import type Konva from "konva";
import { normalizeEdges } from "../layout/flex/engine.js";
import type { EdgeValue } from "../layout/flex/types.js";
import { measure } from "../layout/measure.js";
import { type Box, FINDING_TEXT_MAX, type Hit } from "./findings.js";
import { goTo, type SweepContext } from "./purity.js";

/** Classes whose nodes are content: they have to be read or seen. */
const CONTENT = new Set(["Text", "Image", "Video", "Code"]);

/**
 * Whether a node is content (Text, Image, Video or Code, or a subclass of
 * one), as opposed to decoration that may bleed off the edge. Matched by name
 * along the prototype chain, because core can't import the media and code
 * packages.
 */
export function isContentNode(node: Konva.Node): boolean {
  for (
    let p = Object.getPrototypeOf(node);
    p && p !== Object.prototype;
    p = Object.getPrototypeOf(p)
  ) {
    const name = (p.constructor as { name?: string } | undefined)?.name;
    if (name && CONTENT.has(name)) return true;
  }
  return false;
}

type ProbeText = {
  _kmProbeText(): { full: string; shown: string; cut: boolean; ellipsis: boolean };
};
const hasProbeText = (node: Konva.Node): node is Konva.Node & ProbeText =>
  typeof (node as Partial<ProbeText>)._kmProbeText === "function";

const EPS = 0.5;
const area = (b: Box): number => b.width * b.height;
const boxOf = (node: Konva.Node): Box => {
  const m = measure(node);
  return { x: m.x, y: m.y, width: m.width, height: m.height };
};

/** A layout parent's box inset by its padding and border, in stage pixels. */
function contentBoxOf(parent: Konva.Node): Box | null {
  if ((parent as { _kmRole?: string })._kmRole !== "container") return null;
  const box = boxOf(parent);
  const pad = normalizeEdges(parent.getAttr("padding") as EdgeValue | undefined) ?? [0, 0, 0, 0];
  const border = normalizeEdges(parent.getAttr("borderSize") as EdgeValue | undefined) ?? [
    0, 0, 0, 0,
  ];
  const s = parent.getAbsoluteScale();
  const [top, right, bottom, left] = pad.map((p, i) => p + (border[i] ?? 0));
  return {
    x: box.x + (left ?? 0) * s.x,
    y: box.y + (top ?? 0) * s.y,
    width: box.width - ((left ?? 0) + (right ?? 0)) * s.x,
    height: box.height - ((top ?? 0) + (bottom ?? 0)) * s.y,
  };
}

/** How far a picture may be drawn off its source's shape before it reads as stretched. */
const STRETCH_TOLERANCE = 0.02;

type Bitmap = CanvasImageSource & {
  naturalWidth?: number;
  naturalHeight?: number;
  videoWidth?: number;
  videoHeight?: number;
  displayWidth?: number;
  displayHeight?: number;
  width?: number;
  height?: number;
};

/** The bitmap node a node draws: itself for a raw Konva.Image, the one inside a smoove Image or Video. */
function drawnImage(node: Konva.Node): Konva.Image | null {
  if (node.getClassName() === "Image") return node as Konva.Image;
  if ((node as { _kmRole?: string })._kmRole !== "leaf") return null;
  const child = (node as Konva.Container).getChildren?.().find((c) => c.getClassName() === "Image");
  return (child as Konva.Image | undefined) ?? null;
}

/** The part of the source a Konva.Image draws: its crop, or the whole bitmap. */
function sourceSize(img: Konva.Image): { width: number; height: number } | null {
  const src = img.image() as Bitmap | undefined;
  if (!src) return null;
  const crop = img.crop();
  if (crop.width > 0 && crop.height > 0) return { width: crop.width, height: crop.height };
  const width = src.naturalWidth || src.videoWidth || src.displayWidth || src.width || 0;
  const height = src.naturalHeight || src.videoHeight || src.displayHeight || src.height || 0;
  return width > 0 && height > 0 ? { width, height } : null;
}

/** A stretched-picture hit's details, or null when the picture keeps its shape. */
function stretchOf(node: Konva.Node): Record<string, unknown> | null {
  const img = drawnImage(node);
  if (!img) return null;
  const source = sourceSize(img);
  if (!source) return null;
  // Scale up to the layer only: a transition squeezing a whole scene's layer
  // (`flip`) is a deliberate move, not a stretched picture.
  const s = img.getAbsoluteScale(img.getLayer() ?? undefined);
  const drawn = { width: Math.abs(img.width() * s.x), height: Math.abs(img.height() * s.y) };
  if (!(drawn.width > 0 && drawn.height > 0)) return null;
  const ratio = drawn.width / drawn.height / (source.width / source.height);
  if (Math.abs(Math.log(ratio)) <= Math.log(1 + STRETCH_TOLERANCE)) return null;
  return { source, drawn, ratio };
}

const outside = (inner: Box, outer: Box): boolean =>
  inner.x < outer.x - EPS ||
  inner.y < outer.y - EPS ||
  inner.x + inner.width > outer.x + outer.width + EPS ||
  inner.y + inner.height > outer.y + outer.height + EPS;

/**
 * Text cut by an ellipsis or a silent trim, text running past its layout
 * parent's content box, content partly off the canvas, and, on a vertical
 * canvas, content outside the safe margins. One hit per node, code and
 * sample.
 */
export function layoutSweep(ctx: SweepContext): Hit[] {
  const width = ctx.comp.width();
  const height = ctx.comp.height();
  const canvas: Box = { x: 0, y: 0, width, height };
  const vertical = height > width;
  const safe: Box = {
    x: 0.05 * width,
    y: 0.08 * height,
    width: width - 0.05 * width - 0.12 * width,
    height: height - 0.08 * height - 0.2 * height,
  };

  const hits: Hit[] = [];
  for (const frame of ctx.samples) {
    goTo(ctx.comp, frame);
    for (const node of ctx.nodes()) {
      if (!node.isVisible() || !(node.getAbsoluteOpacity() > 0)) continue;
      const box = boxOf(node);
      if (!(area(box) > 0)) continue;

      if (hasProbeText(node)) {
        const p = node._kmProbeText();
        const full = p.full.slice(0, FINDING_TEXT_MAX);
        if (p.cut) {
          hits.push({
            node,
            code: p.ellipsis ? "layout/text-ellipsis" : "layout/text-overflow",
            frame,
            details: { full, shown: p.shown.slice(0, FINDING_TEXT_MAX) },
          });
        } else {
          const parent = node.getParent();
          const inner = parent ? contentBoxOf(parent) : null;
          if (inner && outside(box, inner)) {
            hits.push({
              node,
              code: "layout/text-overflow",
              frame,
              details: { full, parent: inner },
            });
          }
        }
      }

      const stretch = stretchOf(node);
      if (stretch) hits.push({ node, code: "layout/stretched", frame, details: stretch });

      if (isContentNode(node)) {
        if (outside(box, canvas)) {
          hits.push({ node, code: "layout/off-canvas", frame, details: { box } });
        } else if (vertical && outside(box, safe)) {
          hits.push({ node, code: "layout/safe-zone", frame, details: { box, safe } });
        }
      }
    }
  }
  return hits;
}
