import Konva from "konva";
import { Sequence } from "../engine/sequence.js";
import { isKMLayoutNode, isKMLayoutRoot, type KMLayoutNode, type LayoutBox } from "./contract.js";

export type MeasureOptions = {
  /**
   * Owning sequence's local frame to measure at. Runs the sequence's
   * updaters + non-media ticks (no visibility change, no draw) first.
   */
  at?: number;
};

/** A stage-space axis-aligned rectangle. */
export type MeasuredRect = { x: number; y: number; width: number; height: number };

export type MeasuredLine = MeasuredRect & {
  /**
   * Tight rect around the rendered glyph ink. Falls back to the line box
   * where `actualBoundingBox` metrics are unavailable.
   */
  ink: MeasuredRect;
  /** Stage-space y of the alphabetic baseline — the underline anchor. */
  baseline: number;
  /** Char offsets into the displayed (post-fit/clamp) text. */
  range: { start: number; end: number };
};

export type Measurement = MeasuredRect & {
  /** Text only: one entry per rendered (wrapped) line, top to bottom. */
  lines?: MeasuredLine[];
};

// Re-entrancy guard: an updater running inside a measure-driven frame pass
// must not start another frame pass (updater → measure → updater recursion).
let measuring = false;

/**
 * Measure a node's rendered bounds independent of its sequence's lifetime.
 *
 * Runs the flex compute path for the node's outermost layout root on demand
 * (so a node in a never-activated sequence still measures correctly) and
 * returns stage-space bounds. With `{ at }`, the owning sequence's updaters
 * and ticks are first driven to that local frame — an active sequence is
 * restored to its live frame afterwards (frame purity makes that exact).
 *
 * Bounds reflect currently-loaded fonts; await `comp.whenReady()` first for
 * final glyph bounds in the browser. Rotated nodes yield the axis-aligned
 * bounding box of their rotated geometry.
 */
export function measure(node: Konva.Node, opts: MeasureOptions = {}): Measurement {
  const at = opts.at;
  if (at === undefined) {
    computeRootOf(node);
    return read(node);
  }
  if (!Number.isInteger(at) || at < 0) {
    throw new Error("measure: at must be a non-negative integer local frame");
  }
  const layer = node.getLayer();
  const seq = layer instanceof Sequence ? layer : null;
  if (!seq) throw new Error("measure: { at } requires the node to be inside a Sequence");
  if (measuring) {
    throw new Error("measure: cannot re-enter with { at } from a frame updater");
  }
  const live = seq._kmLiveLocal();
  measuring = true;
  try {
    seq._kmRunFrame(at, false);
    return read(node);
  } finally {
    // Restore an ACTIVE sequence to its live frame so the visible canvas
    // can't be left desynced (frame purity makes this exact). An inactive
    // sequence keeps the measured state — activation re-derives everything.
    if (live !== null && live !== at) seq._kmRunFrame(live, false);
    measuring = false;
  }
}

/** Lay out the outermost KM layout root on the node's ancestor chain. */
function computeRootOf(node: Konva.Node): void {
  let root: (Konva.Node & Required<Pick<KMLayoutNode, "_kmComputeLayout">>) | null = null;
  let cur: Konva.Node | null = node;
  while (cur && !(cur instanceof Konva.Layer) && !(cur instanceof Konva.Stage)) {
    if (isKMLayoutRoot(cur)) root = cur;
    cur = cur.getParent();
  }
  root?._kmComputeLayout();
}

function read(node: Konva.Node): Measurement {
  const t = node.getAbsoluteTransform();
  const box = transformRect(t, localRect(node));
  const lined = node as Konva.Node & Partial<KMLayoutNode>;
  if (typeof lined._kmMeasureLines !== "function") return box;
  const lines = lined._kmMeasureLines().map((l) => ({
    ...transformRect(t, l.rect),
    ink: transformRect(t, l.ink),
    baseline: t.point({ x: l.rect.left, y: l.baseline }).y,
    range: l.range,
  }));
  return { ...box, lines };
}

/**
 * The node's own local-space box: shapes report their self rect (origin-
 * corrected for centered shapes), KM wrappers their layout box, and raw
 * containers the union of their children.
 */
function localRect(node: Konva.Node): LayoutBox {
  if (node instanceof Konva.Shape) {
    const r = node.getSelfRect();
    return { left: r.x, top: r.y, width: r.width, height: r.height };
  }
  if (isKMLayoutNode(node)) {
    return { left: 0, top: 0, width: node.width(), height: node.height() };
  }
  const r = node.getClientRect({ relativeTo: node as Konva.Container });
  return { left: r.x, top: r.y, width: r.width, height: r.height };
}

function transformRect(t: Konva.Transform, r: LayoutBox): MeasuredRect {
  const pts = [
    t.point({ x: r.left, y: r.top }),
    t.point({ x: r.left + r.width, y: r.top }),
    t.point({ x: r.left, y: r.top + r.height }),
    t.point({ x: r.left + r.width, y: r.top + r.height }),
  ];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
