import type Konva from "konva";
import type { Composition } from "../engine/composition.js";
import { measure } from "../layout/measure.js";

/** Errors fail `smoove check`; warnings are reported and pass. */
export type Severity = "error" | "warning";

/** The part of a check code before the slash. */
export type CheckGroup = "purity" | "lint" | "layout" | "intent" | "motion" | "style" | "allow";

/** Every finding's stable code. */
export type CheckCode =
  | "purity/seek-mismatch"
  | "purity/layout-child-position"
  | "purity/math-random"
  | "purity/clock"
  | "purity/random-in-updater"
  | "lint/parse-error"
  | "intent/appears-by"
  | "intent/before"
  | "intent/stays-in-frame"
  | "intent/keeps-moving"
  | "intent/no-match"
  | "layout/text-ellipsis"
  | "layout/text-overflow"
  | "layout/off-canvas"
  | "layout/safe-zone"
  | "layout/contrast"
  | "motion/frozen"
  | "style/color"
  | "style/font"
  | "style/fallback-font"
  | "style/near-duplicate"
  | "style/font-families"
  | "allow/no-match";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a node was created. Lines and columns are 1-based. */
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  /** True when it came from the nearest tagged ancestor. */
  inherited: boolean;
}

/** A node as a finding names it. */
export interface FindingNode {
  name: string | null;
  id: string | null;
  /** The class the author wrote, e.g. "Text". */
  type: string;
  /** Composition pixels, on the finding's first frame. */
  box: Box;
  /** Text nodes only, cut to {@link FINDING_TEXT_MAX} characters. */
  text?: string;
  /** Named ancestors, outermost first. */
  ancestors: string[];
  source: SourceLocation | null;
}

/** Frames a finding covers. Both ends included. */
export interface FrameRange {
  from: number;
  to: number;
}

export interface Finding {
  code: CheckCode;
  severity: Severity;
  /** Still there on a settled stretch, or for half a second or more. */
  held: boolean;
  /** What's wrong and the usual fix, written for the agent. */
  message: string;
  composition: string;
  node: FindingNode | null;
  frames: FrameRange[];
  /** The beats the frames fall in. */
  beats: string[];
  source: SourceLocation | null;
  details?: Record<string, unknown>;
  /** Set by the dev server when an image was asked for. */
  image?: string;
}

/** A beat as the checks see it. `end` is exclusive, `sheet` is the contact sheet's frame. */
export interface CheckBeat {
  name: string;
  start: number;
  settled: number;
  end: number;
  sheet: number;
}

/** One sample's hit: a node and a code, plus details from that sample. */
export interface Hit {
  node: Konva.Node | null;
  code: CheckCode;
  frame: number;
  details?: Record<string, unknown>;
}

/** A hit grouped over the samples it shows up on. */
export interface HitGroup {
  node: Konva.Node | null;
  code: CheckCode;
  frames: FrameRange[];
  beats: string[];
  held: boolean;
  /** From the first held sample, else the first. */
  details?: Record<string, unknown>;
}

/** Text in a finding is cut to this many characters. */
export const FINDING_TEXT_MAX = 80;

/* ============================================================ nodes */

type Tagged = Konva.Node & { _smooveSource?: { file: string; line: number; column: number } };

const isLayer = (node: Konva.Node): boolean => node.nodeType === "Layer";

/** The node's own source tag, or its nearest tagged ancestor's (inherited). */
export function sourceOf(node: Konva.Node): SourceLocation | null {
  for (let cur: Konva.Node | null = node; cur; cur = cur.getParent()) {
    const tag = (cur as Tagged)._smooveSource;
    if (tag) return { ...tag, inherited: cur !== node };
  }
  return null;
}

/** The class the author wrote. A smoove Text extends a Konva Group, so the class name won't do. */
export function typeOf(node: Konva.Node): string {
  const name = node.constructor?.name ?? "";
  // A minified build mangles constructor names to a letter or two.
  return name.length > 2 ? name : node.getClassName();
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
  return raw.length > FINDING_TEXT_MAX ? raw.slice(0, FINDING_TEXT_MAX) : raw;
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

/** A node as a finding names it, measured at the current frame. */
export function describeNode(node: Konva.Node): FindingNode {
  const m = measure(node);
  const text = textOf(node);
  return {
    name: node.name() || null,
    id: node.id() || null,
    type: typeOf(node),
    box: { x: m.x, y: m.y, width: m.width, height: m.height },
    ...(text !== undefined ? { text } : {}),
    ancestors: ancestorsOf(node),
    source: sourceOf(node),
  };
}

/** A smoove node whose children are its own parts (a Text's glyph groups, an Image's picture). */
const isLeaf = (node: Konva.Node): boolean => (node as { _kmRole?: string })._kmRole === "leaf";

/**
 * The nodes an author made, in tree order: every node under `comp` except
 * layers (sequences are layers), the parts inside a smoove leaf such as Text,
 * and a Block's own background and border. Found by structure rather than by
 * source tag, so it works in a test where nothing is tagged.
 */
export function authoredNodes(comp: Composition): Konva.Node[] {
  const out: Konva.Node[] = [];
  const walk = (node: Konva.Node): void => {
    for (const child of (node as Konva.Container).getChildren?.() ?? []) {
      if (child.getAttr("__blockChrome") === true) continue;
      if (!isLayer(child)) out.push(child);
      if (!isLeaf(child)) walk(child);
    }
  };
  walk(comp);
  return out;
}

/** Same box, give or take half a pixel on each edge. */
function sameBox(a: Box, b: Box): boolean {
  return (
    Math.abs(a.x - b.x) <= 0.5 &&
    Math.abs(a.y - b.y) <= 0.5 &&
    Math.abs(a.x + a.width - (b.x + b.width)) <= 0.5 &&
    Math.abs(a.y + a.height - (b.y + b.height)) <= 0.5
  );
}

/**
 * Leave out a node that has no source tag of its own and only fills an
 * ancestor's box: a smoove node's own parts, like the Konva Text inside a
 * Text or a Block's background. Tagged nodes, and parts with a box of their
 * own (the tokens in a Code node), stay.
 */
export function dropFillers<T extends { box: Box }>(
  items: T[],
  parentOf: (item: T) => T | null,
  tagged: (item: T) => boolean,
): T[] {
  return items.filter((item) => {
    if (tagged(item)) return true;
    for (let p = parentOf(item); p; p = parentOf(p)) {
      if (sameBox(p.box, item.box)) return false;
    }
    return true;
  });
}

/* ============================================================ grouping */

/** The sweep's stride: about ten samples a second. */
export const sweepStride = (fps: number): number => Math.max(1, Math.round(fps / 10));

function inStretch(frame: number, beats: CheckBeat[]): boolean {
  return beats.some((b) => frame >= b.settled && frame <= b.sheet);
}

/**
 * Group per-sample hits by node and code into frame ranges. Hits on adjacent
 * samples share a range. A group is held when one of its samples sits on a
 * beat's settled stretch, or one of its ranges lasts half a second or more.
 */
export function groupSamples(
  hits: Hit[],
  samples: number[],
  beats: CheckBeat[],
  fps: number,
): HitGroup[] {
  const index = new Map(samples.map((f, i) => [f, i]));
  const stride = sweepStride(fps);
  const groups = new Map<unknown, Map<CheckCode, Hit[]>>();
  const order: Array<[Konva.Node | null, CheckCode]> = [];
  for (const h of hits) {
    let byCode = groups.get(h.node);
    if (!byCode) {
      byCode = new Map();
      groups.set(h.node, byCode);
    }
    let list = byCode.get(h.code);
    if (!list) {
      list = [];
      byCode.set(h.code, list);
      order.push([h.node, h.code]);
    }
    list.push(h);
  }

  return order.map(([node, code]) => {
    const list = [...(groups.get(node)?.get(code) ?? [])].sort((a, b) => a.frame - b.frame);
    const frames: FrameRange[] = [];
    let prevIndex = Number.NaN;
    for (const h of list) {
      const i = index.get(h.frame) ?? Number.NaN;
      const last = frames.at(-1);
      if (last && i === prevIndex + 1) last.to = h.frame;
      else if (!last || h.frame !== last.to) frames.push({ from: h.frame, to: h.frame });
      prevIndex = i;
    }
    const heldHit = list.find((h) => inStretch(h.frame, beats));
    const long = frames.some((r) => r.to - r.from + stride >= fps / 2);
    const names = beats
      .filter((b) => frames.some((r) => r.from < b.end && r.to >= b.start))
      .map((b) => b.name);
    const details = (heldHit ?? list[0])?.details;
    return {
      node,
      code,
      frames,
      beats: names,
      held: heldHit !== undefined || long,
      ...(details ? { details } : {}),
    };
  });
}

/** Errors first, then held before passing, then by first frame. */
export function sortFindings(findings: Finding[]): Finding[] {
  const first = (f: Finding): number => f.frames[0]?.from ?? Number.POSITIVE_INFINITY;
  return [...findings].sort(
    (a, b) =>
      (a.severity === "error" ? 0 : 1) - (b.severity === "error" ? 0 : 1) ||
      (a.held ? 0 : 1) - (b.held ? 0 : 1) ||
      first(a) - first(b),
  );
}
