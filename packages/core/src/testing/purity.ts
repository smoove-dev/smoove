import type Konva from "konva";
import type { Composition } from "../engine/composition.js";
import { watchUpdaterWrites } from "../engine/write-watch.js";
import { measure } from "../layout/measure.js";
import { authoredNodes, type Box, type CheckBeat, type Hit } from "./findings.js";
import { readPaint } from "./probe.js";
import { checkBeats, sampleFrames } from "./sampling.js";

/** What every run-time check works from. */
export interface SweepContext {
  comp: Composition;
  beats: CheckBeat[];
  /** The sweep's frames, ascending. */
  samples: number[];
  /** The coarser grid contrast draws on, ascending. */
  contrastSamples: number[];
  /** The nodes an author made, at the current frame (see {@link authoredNodes}). */
  nodes(): Konva.Node[];
}

export function sweepContext(
  comp: Composition,
  beats: CheckBeat[] = checkBeats(comp),
): SweepContext {
  const total = comp.durationInFrames.get();
  return {
    comp,
    beats,
    samples: sampleFrames(total, comp.fps, beats, "sweep"),
    contrastSamples: sampleFrames(total, comp.fps, beats, "contrast"),
    nodes: () => authoredNodes(comp),
  };
}

/** Drive `comp` to `frame`, re-running it when it's already there. */
export function goTo(comp: Composition, frame: number): void {
  if (comp.frame.get() === frame) comp.refresh();
  else comp.setFrame(frame);
}

/** Everything about a node the seek test and the frozen-stretch check compare. */
export interface NodeState {
  box: Box;
  opacity: number;
  visible: boolean;
  rotation: number;
  scaleX: number;
  scaleY: number;
  paint: string;
  text: string | null;
}

/**
 * Read a node's state without moving anything: `measure()` lays out but runs
 * no updater, so reading never changes what the next frame shows.
 */
export function readState(node: Konva.Node): NodeState {
  const m = measure(node);
  const opacity = node.getAbsoluteOpacity();
  const scale = node.getAbsoluteScale();
  const probeText = (node as { _kmProbeText?: () => { shown: string } })._kmProbeText;
  return {
    box: { x: m.x, y: m.y, width: m.width, height: m.height },
    opacity,
    visible: node.isVisible() && opacity > 0,
    rotation: node.getAbsoluteRotation(),
    scaleX: scale.x,
    scaleY: scale.y,
    paint: JSON.stringify(readPaint(node) ?? null),
    text: probeText ? probeText.call(node).shown : null,
  };
}

const BOX_EPS = 0.5;
const VALUE_EPS = 0.01;

/** The first attribute that differs beyond the tolerances, or null. */
export function stateDiff(a: NodeState, b: NodeState): keyof NodeState | null {
  // A node nobody sees keeps whatever its updater last wrote, and that
  // depends on the order frames were visited: only what paints counts.
  if (!a.visible && !b.visible) return null;
  const edge = (p: number, q: number) => Math.abs(p - q) > BOX_EPS;
  if (
    edge(a.box.x, b.box.x) ||
    edge(a.box.y, b.box.y) ||
    edge(a.box.x + a.box.width, b.box.x + b.box.width) ||
    edge(a.box.y + a.box.height, b.box.y + b.box.height)
  ) {
    return "box";
  }
  if (Math.abs(a.opacity - b.opacity) > VALUE_EPS) return "opacity";
  if (a.visible !== b.visible) return "visible";
  if (Math.abs(a.rotation - b.rotation) > VALUE_EPS) return "rotation";
  if (Math.abs(a.scaleX - b.scaleX) > VALUE_EPS || Math.abs(a.scaleY - b.scaleY) > VALUE_EPS) {
    return "scaleX";
  }
  if (a.paint !== b.paint) return "paint";
  if (a.text !== b.text) return "text";
  return null;
}

function snapshot(ctx: SweepContext): Map<Konva.Node, NodeState> {
  const out = new Map<Konva.Node, NodeState>();
  for (const node of ctx.nodes()) out.set(node, readState(node));
  return out;
}

/**
 * Walk the samples in order, then visit them again from the last back to the
 * first, and report every node that comes out different. A composition that
 * is a function of its frame always matches.
 */
export function seekTest(ctx: SweepContext): Hit[] {
  const walked = new Map<number, Map<Konva.Node, NodeState>>();
  for (const f of ctx.samples) {
    goTo(ctx.comp, f);
    walked.set(f, snapshot(ctx));
  }
  const hits: Hit[] = [];
  for (const f of [...ctx.samples].reverse()) {
    if (ctx.comp.frame.get() === f) continue; // where the walk ended: not a jump
    ctx.comp.setFrame(f);
    const before = walked.get(f);
    if (!before) continue;
    for (const [node, jumped] of snapshot(ctx)) {
      const was = before.get(node);
      if (!was) continue;
      const attr = stateDiff(was, jumped);
      if (attr) {
        hits.push({
          node,
          code: "purity/seek-mismatch",
          frame: f,
          details: { attr, walked: was[attr], jumped: jumped[attr] },
        });
      }
    }
  }
  return hits;
}

const isLaidOut = (node: Konva.Node): boolean =>
  (node.getParent() as { _kmRole?: string } | null)?._kmRole === "container";

/**
 * Walk the samples with the updater write watch on, and report every x or y
 * an updater wrote to a node a `Flex` or `Block` positions. Layout overwrites
 * those writes, so the animation never shows.
 */
export function layoutChildWrites(ctx: SweepContext): Hit[] {
  const hits: Hit[] = [];
  const seen = new Set<string>();
  let frame = -1;
  const stop = watchUpdaterWrites((w) => {
    if (!isLaidOut(w.node)) return;
    const key = `${w.node._id}:${frame}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({
      node: w.node,
      code: "purity/layout-child-position",
      frame,
      details: { attr: w.attr },
    });
  });
  try {
    for (const f of ctx.samples) {
      frame = f;
      goTo(ctx.comp, f);
    }
  } finally {
    stop();
  }
  return hits;
}
