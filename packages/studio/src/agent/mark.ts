import {
  closestMarked,
  DEFAULT_SNAPSHOT_WIDTH,
  MARK_TEXT_MAX,
  type MarkInput,
  type MarkNode,
  type MarkRect,
  selectMarked,
} from "@smoove/agent";
import { type Composition, measure } from "@smoove/core";
import { dropFillers, sourceOf, typeOf } from "@smoove/core/testing";
import type Konva from "konva";
import { beatAt, beatsOf } from "./beats.js";
import { captureFrames, encodePng, scaleCanvas } from "./capture.js";

/** The tag the smoove Vite plugin puts on a node in development. */
type Tagged = Konva.Node & { _smooveSource?: { file: string; line: number; column: number } };

const isLayer = (node: Konva.Node): boolean => node.nodeType === "Layer";

/**
 * Every node that paints on the current frame, with its box in composition
 * pixels. Leaves out the stage, layers and sequences (sequences are layers):
 * they cover the whole frame and say nothing about what the user meant.
 */
export function markCandidates(
  comp: Composition,
): Array<{ node: Konva.Node; box: MarkRect; content: MarkRect }> {
  const out: Array<{ node: Konva.Node; box: MarkRect; content: MarkRect }> = [];
  for (const node of comp.find(() => true) as Konva.Node[]) {
    if (isLayer(node)) continue;
    // The same test the probes use: it and every ancestor visible, and some opacity left.
    if (!node.isVisible() || !(node.getAbsoluteOpacity() > 0)) continue;
    const m = measure(node);
    if (!(m.width > 0 && m.height > 0)) continue;
    const box = { x: m.x, y: m.y, width: m.width, height: m.height };
    const ink = m.lines?.length ? union(m.lines.map((l) => l.ink)) : konvaTextBox(node);
    out.push({ node, box, content: ink ?? box });
  }
  return out;
}

/**
 * Where a raw Konva Text's lines actually sit: its box is as wide as its
 * `width`, often far wider than the words, so a rectangle around the words
 * would cover too little of it. Null for anything else.
 */
function konvaTextBox(node: Konva.Node): MarkRect | null {
  const t = node as Konva.Node & {
    textArr?: Array<{ width: number }>;
    fontSize?: () => number;
    lineHeight?: () => number;
    padding?: () => number;
    align?: () => string;
    width: () => number;
  };
  if (node.getClassName() !== "Text" || !Array.isArray(t.textArr) || t.textArr.length === 0) {
    return null;
  }
  const lineH = (t.fontSize?.() ?? 0) * (t.lineHeight?.() ?? 1);
  const pad = t.padding?.() ?? 0;
  const w = t.width();
  const align = t.align?.() ?? "left";
  const abs = node.getAbsoluteTransform();
  return union(
    t.textArr.map((line, i) => {
      const x =
        align === "right" ? w - pad - line.width : align === "center" ? (w - line.width) / 2 : pad;
      const corners = [
        abs.point({ x, y: pad + i * lineH }),
        abs.point({ x: x + line.width, y: pad + (i + 1) * lineH }),
      ];
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    }),
  );
}

function union(rects: MarkRect[]): MarkRect | null {
  const live = rects.filter((r) => r.width > 0 && r.height > 0);
  if (live.length === 0) return null;
  const x = Math.min(...live.map((r) => r.x));
  const y = Math.min(...live.map((r) => r.y));
  const right = Math.max(...live.map((r) => r.x + r.width));
  const bottom = Math.max(...live.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

function textOf(node: Konva.Node): string | undefined {
  const n = node as Konva.Node & { getText?: () => unknown; text?: () => unknown };
  const raw =
    typeof n.getText === "function"
      ? n.getText()
      : typeof n.text === "function"
        ? n.text()
        : undefined;
  if (typeof raw !== "string") return undefined;
  return raw.length > MARK_TEXT_MAX ? raw.slice(0, MARK_TEXT_MAX) : raw;
}

/** Named ancestors up to the layer, outermost first. */
function ancestorsOf(node: Konva.Node): string[] {
  const names: string[] = [];
  for (let p = node.getParent(); p && !isLayer(p); p = p.getParent()) {
    const name = p.name();
    if (name) names.push(name);
  }
  return names.reverse();
}

/**
 * Build the user's mark on the current frame: the covered nodes, smallest
 * first, and a 640-wide image of the frame with the rectangle stroked on it.
 * The rectangle is drawn on the copy only, never on the composition.
 */
export async function buildMark(
  comp: Composition,
  compositionId: string,
  rect: MarkRect,
): Promise<{ mark: MarkInput; png: Blob }> {
  const started = performance.now();
  const frame = comp.frame.get();
  const candidates = markCandidates(comp);
  const byNode = new Map(candidates.map((c) => [c.node, c]));
  const parentOf = (c: { node: Konva.Node }) => {
    for (let p = c.node.getParent(); p && !isLayer(p); p = p.getParent()) {
      const found = byNode.get(p);
      if (found) return found;
    }
    return null;
  };
  const authored = dropFillers(
    candidates,
    parentOf,
    (c) => (c.node as Tagged)._smooveSource != null,
  );
  // The parts rule above compares layout boxes; coverage uses where the
  // content is, so a wide text box still counts when its words are framed.
  const byContent = authored.map((c) => ({ node: c.node, box: c.content }));
  const passed = selectMarked(byContent, rect);
  const closest = passed.length === 0;
  const picked = closest ? closestMarked(byContent, rect) : passed;
  const nodes: MarkNode[] = picked.map(({ node, box, cover }) => {
    const text = textOf(node);
    return {
      name: node.name() || null,
      id: node.id() || null,
      type: typeOf(node),
      box,
      cover,
      ...(text != null ? { text } : {}),
      ancestors: ancestorsOf(node),
      source: sourceOf(node),
    };
  });

  const compW = comp.width();
  const compH = comp.height();
  const width = Math.min(DEFAULT_SNAPSHOT_WIDTH, compW);
  const height = Math.max(1, Math.round((width * compH) / compW));
  let image: HTMLCanvasElement | null = null;
  await captureFrames(comp, [frame], width / compW, (canvas) => {
    image = scaleCanvas(canvas, width, height);
  });
  if (!image) throw new Error("The mark's frame drew nothing.");
  strokeRect(image, rect, width / compW);

  const mark: MarkInput = {
    id: crypto.randomUUID(),
    composition: compositionId,
    frame,
    beat: beatAt(beatsOf(comp).beats, frame),
    rect,
    nodes,
    ...(closest && nodes.length > 0 ? { closest: true } : {}),
  };
  const png = encodePng(image);
  console.debug(
    `[smoove] mark built in ${Math.round(performance.now() - started)} ms (${nodes.length} nodes)`,
  );
  return { mark, png };
}

/** A bright outline over a thin dark one, so it reads on any frame. */
export function strokeRect(canvas: HTMLCanvasElement, rect: MarkRect, scale: number): void {
  const g = canvas.getContext("2d");
  if (!g) return;
  const x = rect.x * scale;
  const y = rect.y * scale;
  const w = rect.width * scale;
  const h = rect.height * scale;
  g.save();
  g.strokeStyle = "#000";
  g.lineWidth = 5;
  g.strokeRect(x, y, w, h);
  g.strokeStyle = "#ff3b6b";
  g.lineWidth = 3;
  g.strokeRect(x, y, w, h);
  g.restore();
}
