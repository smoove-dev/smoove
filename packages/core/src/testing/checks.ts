import type Konva from "konva";
import type { Composition } from "../engine/composition.js";
import type { Marker, MarkerPoint } from "../engine/marker.js";
import { measure } from "../layout/measure.js";
import { contrastSweep } from "./contrast.js";
import {
  type Box,
  type CheckBeat,
  type CheckCode,
  type CheckGroup,
  describeNode,
  type Finding,
  type FrameRange,
  groupSamples,
  type Hit,
  type HitGroup,
  sortFindings,
} from "./findings.js";
import { layoutSweep } from "./layout.js";
import {
  goTo,
  layoutChildWrites,
  type NodeState,
  readState,
  type SweepContext,
  seekTest,
  stateDiff,
  sweepContext,
} from "./purity.js";
import { checkBeats } from "./sampling.js";
import { type StyleDeclaration, styleSweep } from "./style.js";

/* ============================================================ the checks file */

/** A point in time: a frame, a time in seconds, or a beat point from the plan. */
export type CheckAt = number | { time: number } | MarkerPoint;

export type Intent =
  | { kind: "appears-by"; select: string; at: CheckAt }
  | { kind: "before"; first: string; second: string }
  | { kind: "stays-in-frame"; select: string }
  | { kind: "keeps-moving"; maxStill: CheckAt; except: Marker[] };

/**
 * Every node `select` matches has been visible by `at`: on some frame up to
 * and including it. A node that fades out before `at` still passes. Give a
 * node its own name when a shared one (`.caption`) matches others that come
 * later.
 */
export function appearsBy(select: string, at: CheckAt): Intent {
  return { kind: "appears-by", select, at };
}

/** `first` is visible before `second` is. The earliest match of each counts. */
export function before(first: string, second: string): Intent {
  return { kind: "before", first, second };
}

/** From the first frame a node is visible to the last, its box stays inside the canvas. */
export function staysInFrame(select: string): Intent {
  return { kind: "stays-in-frame", select };
}

/** No stretch longer than `maxStill` (two seconds by default) where nothing changes, outside `except`. */
export function keepsMoving(options: { maxStill?: CheckAt; except?: Marker[] } = {}): Intent {
  return {
    kind: "keeps-moving",
    maxStill: options.maxStill ?? { time: 2 },
    except: options.except ?? [],
  };
}

/** Excuse the findings on `select`'s nodes from `checks`, for a stated reason. */
export interface AllowEntry {
  select: string;
  checks: Array<CheckCode | CheckGroup>;
  reason: string;
  /** Only findings whose frames all fall inside these beats. */
  beats?: Marker[];
}

export interface ChecksOptions {
  intent?: Intent[];
  allow?: AllowEntry[];
  style?: StyleDeclaration;
}

export interface Checks {
  readonly composition: AnyComposition;
  readonly options: ChecksOptions;
  readonly __smooveChecks: true;
}

/**
 * A composition with any props. `Composition<P>` is invariant in P (through
 * setProps), so a typed composition doesn't fit a plain `Composition` param.
 */
// biome-ignore lint/suspicious/noExplicitAny: the checks never read props; P is invariant via setProps.
type AnyComposition = Composition<any>;

/** What a checks file default-exports. Throws when an allow entry has no reason. */
export function defineChecks(comp: AnyComposition, options: ChecksOptions): Checks {
  for (const entry of options.allow ?? []) {
    if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
      throw new Error(
        `defineChecks: the allow entry for "${entry.select}" needs a reason, so the next reader knows why it's allowed.`,
      );
    }
  }
  return Object.freeze({ composition: comp, options, __smooveChecks: true as const });
}

export function isChecks(value: unknown): value is Checks {
  return (value as Partial<Checks> | null)?.__smooveChecks === true;
}

/** A checks file that can't be used, naming the file. */
export class ChecksError extends Error {
  readonly file: string;
  constructor(file: string, message: string) {
    super(message);
    this.name = "ChecksError";
    this.file = file;
  }
}

/** The checks a loaded module default-exports, or a {@link ChecksError} naming `file`. */
export function checksFrom(module: unknown, file: string): Checks {
  const value = (module as { default?: unknown } | null)?.default;
  if (isChecks(value)) return value;
  throw new ChecksError(
    file,
    `${file} must default-export defineChecks(composition, { ... }) from @smoove/core/testing.`,
  );
}

/* ============================================================ running */

export interface RunOptions {
  /** The beats to judge by. Defaults to the plan, or the top-level sequences. */
  beats?: CheckBeat[];
  /** Run only these groups. `lint` runs in the smoove command, never here. */
  groups?: CheckGroup[];
}

export interface CheckReport {
  findings: Finding[];
  allowed: Array<Finding & { reason: string }>;
  /** How many frames the sweep visited. */
  samples: number;
  /** Colors in use, most used first. */
  colorsInUse: string[];
}

const ALL_GROUPS: CheckGroup[] = ["purity", "layout", "intent", "motion", "style", "allow"];
const UNALLOWABLE = new Set<CheckCode>(["purity/seek-mismatch", "purity/layout-child-position"]);

function frameOf(comp: Composition, at: CheckAt): number {
  if (typeof at === "number") return at;
  if ("time" in at) return Math.round(at.time * comp.fps);
  return at.resolve();
}

const span = (m: Marker): FrameRange => ({ from: m.start.resolve(), to: m.end.resolve() - 1 });
const isVisible = (node: Konva.Node): boolean => node.isVisible() && node.getAbsoluteOpacity() > 0;
const EPS = 0.5;
const inside = (b: Box, w: number, h: number): boolean =>
  b.x >= -EPS && b.y >= -EPS && b.x + b.width <= w + EPS && b.y + b.height <= h + EPS;

function severityOf(code: CheckCode, held: boolean): Finding["severity"] {
  if (code.startsWith("intent/") || UNALLOWABLE.has(code)) return "error";
  if (
    code === "layout/text-ellipsis" ||
    code === "layout/text-overflow" ||
    code === "layout/stretched"
  )
    return held ? "error" : "warning";
  return "warning";
}

const fmtFrames = (s: number) => `${Math.round(s * 10) / 10} seconds`;

/** What's wrong and the usual fix, for the agent. */
function messageFor(code: CheckCode, d: Record<string, unknown> = {}, fps = 30): string {
  switch (code) {
    case "purity/seek-mismatch":
      return `Jumping to this frame gives a different ${String(d.attr)} than playing up to it. Something in an updater isn't a function of the frame: Math.random, the clock, a generator advanced inside the updater, or state kept between frames.`;
    case "purity/layout-child-position":
      return `An updater sets ${String(d.attr ?? "x")} on a node its Flex or Block positions, so layout overwrites it. Animate scale or opacity instead, or move the parent.`;
    case "intent/appears-by":
      return Number(d.matches) > 1
        ? `Expected to be visible by frame ${String(d.frame)}, but it isn't. ${String(d.select)} matches ${String(d.matches)} nodes and each one has to be; give this one its own name if only it should be.`
        : `Expected to be visible by frame ${String(d.frame)}, but it isn't.`;
    case "intent/before":
      return `Expected ${String(d.first)} to appear before ${String(d.second)}, but ${String(d.second)} came first (frame ${String(d.secondAt)}).`;
    case "intent/stays-in-frame":
      return "Expected to stay inside the canvas while visible, but it leaves it.";
    case "intent/keeps-moving":
      return `Nothing moves for ${fmtFrames(Number(d.length) / fps)}, longer than the ${fmtFrames(Number(d.max) / fps)} the checks file allows.`;
    case "intent/no-match":
      return `The selector ${String(d.select)} matches no node, so this intent can't pass. Fix the selector or name the node.`;
    case "layout/text-ellipsis":
      return "The text is cut with an ellipsis. Give it more width, a smaller font size, or fewer words.";
    case "layout/text-overflow":
      return d.parent
        ? "The text runs past the content box of the Block or Flex that holds it. Give it room, or let it wrap."
        : "The text is trimmed to fit its box, with no ellipsis, so words go missing. Give it more room or fewer words.";
    case "layout/off-canvas":
      return "Content runs off the canvas. Move it inside, or allow it if the bleed is on purpose.";
    case "layout/safe-zone":
      return "Content sits outside the vertical safe zone, where a feed's buttons and captions cover it.";
    case "layout/contrast": {
      const fix = !d.suggestion
        ? " No palette color passes on this background."
        : d.suggestionName
          ? ` The palette's ${String(d.suggestionName)}, ${String(d.suggestion)}, passes.`
          : ` ${String(d.suggestion)}, a color already in use, passes.`;
      return `Contrast ${Number(d.ratio).toFixed(1)} to 1, ${String(d.text)} on ${String(d.background)}, under the floor of ${String(d.floor)} to 1.${fix}`;
    }
    case "layout/stretched": {
      const ratio = Number(d.ratio);
      const src = d.source as { width: number; height: number } | undefined;
      const percent = Math.round(Math.abs(ratio - 1) * 100);
      const way = ratio > 1 ? "wider" : "narrower";
      const looks = ratio > 1 ? "stretched" : "squashed";
      return `This picture is drawn ${percent} percent ${way} than its source (${src?.width} by ${src?.height}), so it looks ${looks}. Use objectFit "cover" to crop it to its box or "contain" to fit it inside, and scale it the same on both axes.`;
    }
    case "motion/frozen":
      return `Nothing moves for ${fmtFrames(Number(d.length) / fps)}. Add motion, or say in the checks file that this beat may hold.`;
    case "style/color":
      return `${String(d.color)} isn't in the palette. Use a palette color.`;
    case "style/font":
      return `${String(d.family)} at weight ${String(d.weight)} isn't one of the declared fonts.`;
    case "style/fallback-font":
      return `${String(d.family)} at weight ${String(d.weight)} never loaded, so this text draws in a fallback face. Add the font to the sequence and check its file.`;
    case "style/near-duplicate":
      return `${String(d.color)} is almost ${String(d.near)}. Pick one, or declare a palette.`;
    case "style/font-families":
      return `More than two font families are in use: ${(d.families as string[] | undefined)?.join(", ") ?? ""}.`;
    case "allow/no-match":
      return `The allow entry for ${String(d.select)} matches no node. Remove it, or fix its selector.`;
    default:
      return code;
  }
}

/** The Konva node behind each finding, for the allow list. */
const nodeOf = new WeakMap<Finding, Konva.Node>();

/** A finding for a group of hits, with its node described on its first frame. */
function toFinding(comp: Composition, g: HitGroup): Finding {
  const first = g.frames[0]?.from;
  if (g.node && first !== undefined) goTo(comp, first);
  const node = g.node ? describeNode(g.node) : null;
  const finding: Finding = {
    code: g.code,
    severity: severityOf(g.code, g.held),
    held: g.held,
    message: messageFor(g.code, g.details, comp.fps),
    composition: comp.id(),
    node,
    frames: g.frames,
    beats: g.beats,
    source: node?.source ?? null,
    ...(g.details ? { details: g.details } : {}),
  };
  if (g.node) nodeOf.set(finding, g.node);
  return finding;
}

/** Whether `node` or one of its ancestors is in `set`. */
function under(node: Konva.Node | undefined, set: Set<Konva.Node>): boolean {
  for (let p: Konva.Node | null = node ?? null; p; p = p.getParent()) if (set.has(p)) return true;
  return false;
}

/** Consecutive frames from a sorted list, as ranges. */
function rangesOf(frames: number[]): FrameRange[] {
  const out: FrameRange[] = [];
  for (const f of frames) {
    const last = out.at(-1);
    if (last && f === last.to + 1) last.to = f;
    else out.push({ from: f, to: f });
  }
  return out;
}

function beatsIn(frames: FrameRange[], beats: CheckBeat[]): string[] {
  return beats
    .filter((b) => frames.some((r) => r.from < b.end && r.to >= b.start))
    .map((b) => b.name);
}

/** Walk every frame once and record, per frame, which of `nodes` are visible and their boxes. */
function walkAll(comp: Composition, nodes: Konva.Node[]): Array<Map<Konva.Node, Box | null>> {
  const total = comp.durationInFrames.get();
  const out: Array<Map<Konva.Node, Box | null>> = [];
  for (let f = 0; f < total; f++) {
    goTo(comp, f);
    const row = new Map<Konva.Node, Box | null>();
    for (const n of nodes) {
      if (!isVisible(n)) {
        row.set(n, null);
        continue;
      }
      const m = measure(n);
      row.set(n, { x: m.x, y: m.y, width: m.width, height: m.height });
    }
    out.push(row);
  }
  return out;
}

function intentHits(comp: Composition, intents: Intent[], beats: CheckBeat[]): Finding[] {
  const out: Finding[] = [];
  const nodeIntents = intents.filter(
    (i): i is Exclude<Intent, { kind: "keeps-moving" }> => i.kind !== "keeps-moving",
  );
  if (nodeIntents.length === 0) return out;

  const selectors = new Set<string>();
  for (const i of nodeIntents) {
    if (i.kind === "before") {
      selectors.add(i.first);
      selectors.add(i.second);
    } else selectors.add(i.select);
  }
  const matched = new Map<string, Konva.Node[]>();
  for (const s of selectors) matched.set(s, comp.find(s) as Konva.Node[]);
  const all = [...new Set([...matched.values()].flat())];
  const rows = walkAll(comp, all);
  const w = comp.width();
  const h = comp.height();
  const firstVisible = (nodes: Konva.Node[]): { frame: number; node: Konva.Node } | null => {
    for (let f = 0; f < rows.length; f++) {
      for (const n of nodes) if (rows[f]?.get(n)) return { frame: f, node: n };
    }
    return null;
  };
  const make = (
    code: CheckCode,
    node: Konva.Node | null,
    frames: FrameRange[],
    details: Record<string, unknown>,
  ): Finding =>
    toFinding(comp, { node, code, frames, beats: beatsIn(frames, beats), held: true, details });

  for (const intent of nodeIntents) {
    const names = intent.kind === "before" ? [intent.first, intent.second] : [intent.select];
    const missing = names.find((s) => (matched.get(s) ?? []).length === 0);
    if (missing) {
      out.push({
        code: "intent/no-match",
        severity: "error",
        held: true,
        message: messageFor("intent/no-match", { select: missing }),
        composition: comp.id(),
        node: null,
        frames: [],
        beats: [],
        source: null,
        details: { select: missing, intent: intent.kind },
      });
      continue;
    }
    if (intent.kind === "appears-by") {
      const frame = Math.max(0, Math.min(rows.length - 1, frameOf(comp, intent.at)));
      const nodes = matched.get(intent.select) ?? [];
      for (const n of nodes) {
        if (!rows.slice(0, frame + 1).some((row) => row.get(n))) {
          out.push(
            make("intent/appears-by", n, [{ from: frame, to: frame }], {
              frame,
              select: intent.select,
              matches: nodes.length,
            }),
          );
        }
      }
    } else if (intent.kind === "before") {
      const a = firstVisible(matched.get(intent.first) ?? []);
      const b = firstVisible(matched.get(intent.second) ?? []);
      if (b && (!a || a.frame >= b.frame)) {
        out.push(
          make("intent/before", a?.node ?? b.node, [{ from: b.frame, to: b.frame }], {
            first: intent.first,
            second: intent.second,
            secondAt: b.frame,
            firstAt: a?.frame ?? null,
          }),
        );
      }
    } else if (intent.kind === "stays-in-frame") {
      for (const n of matched.get(intent.select) ?? []) {
        const bad: number[] = [];
        rows.forEach((row, f) => {
          const box = row.get(n);
          if (box && !inside(box, w, h)) bad.push(f);
        });
        if (bad.length > 0)
          out.push(make("intent/stays-in-frame", n, rangesOf(bad), { select: intent.select }));
      }
    }
  }
  return out;
}

/** Stretches longer than `max` frames where no visible node changes, outside `except`. */
function stillStretches(ctx: SweepContext, max: number, except: FrameRange[]): FrameRange[] {
  const excused = (f: number) => except.some((r) => f >= r.from && f <= r.to);
  const out: FrameRange[] = [];
  let prev: Map<Konva.Node, NodeState> | null = null;
  let start: number | null = null;
  let last: number | null = null;
  const close = () => {
    if (start !== null && last !== null && last - start > max) out.push({ from: start, to: last });
    start = null;
  };
  for (const f of ctx.samples) {
    if (excused(f)) {
      close();
      prev = null;
      continue;
    }
    goTo(ctx.comp, f);
    const now = new Map<Konva.Node, NodeState>();
    let playing = false;
    for (const n of ctx.nodes()) {
      if (!isVisible(n)) continue;
      now.set(n, readState(n));
      if (isVideo(n)) playing = true;
    }
    let changed = playing || prev === null || prev.size !== now.size;
    if (!changed && prev) {
      for (const [n, s] of now) {
        const was = prev.get(n);
        if (!was || stateDiff(was, s)) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      close();
      start = f;
    } else if (start === null) start = f;
    last = f;
    prev = now;
  }
  close();
  return out;
}

const isVideo = (node: Konva.Node): boolean => {
  for (
    let p = Object.getPrototypeOf(node);
    p && p !== Object.prototype;
    p = Object.getPrototypeOf(p)
  ) {
    if ((p.constructor as { name?: string } | undefined)?.name === "Video") return true;
  }
  return false;
};

function codeMatches(code: CheckCode, list: Array<CheckCode | CheckGroup>): boolean {
  return list.some((c) => c === code || code.startsWith(`${c}/`));
}

/**
 * Run every run-time check on `comp` and resolve to the findings, sorted:
 * errors first, then held before passing, then by first frame. The
 * composition is left on the frame it was on.
 */
export async function runChecks(
  comp: AnyComposition,
  checks?: Checks | null,
  options: RunOptions = {},
): Promise<CheckReport> {
  const startFrame = comp.frame.get();
  const beats = options.beats ?? checkBeats(comp);
  const ctx = sweepContext(comp, beats);
  const groups = new Set(options.groups ?? ALL_GROUPS);
  const opts = checks?.options ?? {};
  const intents = opts.intent ?? [];
  const keeps = intents.find(
    (i): i is Extract<Intent, { kind: "keeps-moving" }> => i.kind === "keeps-moving",
  );
  const findings: Finding[] = [];
  const group = (hits: Hit[], samples: number[]) =>
    groupSamples(hits, samples, beats, comp.fps).map((g) => toFinding(comp, g));
  let colorsInUse: string[] = [];

  try {
    if (groups.has("purity")) {
      findings.push(...group([...seekTest(ctx), ...layoutChildWrites(ctx)], ctx.samples));
    }
    if (groups.has("style")) {
      const s = styleSweep(ctx, opts.style ?? null);
      colorsInUse = s.colorsInUse;
      findings.push(...group(s.hits, ctx.samples));
    }
    if (groups.has("layout")) {
      findings.push(...group(layoutSweep(ctx), ctx.samples));
      const palette = opts.style?.palette
        ? Object.values(opts.style.palette)
        : colorsInUse.length > 0
          ? colorsInUse
          : null;
      const names = new Map<string, string>();
      for (const [name, color] of Object.entries(opts.style?.palette ?? {})) {
        names.set(color.toLowerCase(), name);
      }
      const contrast = await contrastSweep(ctx, palette);
      for (const h of contrast) {
        const name = names.get(String(h.details?.suggestion ?? ""));
        if (name && h.details) h.details.suggestionName = name;
      }
      findings.push(...group(contrast, ctx.contrastSamples));
    }
    if (groups.has("intent")) findings.push(...intentHits(comp, intents, beats));
    if ((keeps && groups.has("intent")) || (!keeps && groups.has("motion"))) {
      const max = keeps ? frameOf(comp, keeps.maxStill) : 2 * comp.fps;
      const code: CheckCode = keeps ? "intent/keeps-moving" : "motion/frozen";
      for (const r of stillStretches(ctx, max, (keeps?.except ?? []).map(span))) {
        const details = { length: r.to - r.from, max };
        findings.push({
          code,
          severity: severityOf(code, true),
          held: true,
          message: messageFor(code, details, comp.fps),
          composition: comp.id(),
          node: null,
          frames: [r],
          beats: beatsIn([r], beats),
          source: null,
          details,
        });
      }
    }

    // The allow list.
    const allowed: Array<Finding & { reason: string }> = [];
    const kept: Finding[] = [];
    const entries = (opts.allow ?? []).map((e) => ({
      entry: e,
      nodes: new Set(comp.find(e.select) as Konva.Node[]),
    }));
    for (const f of findings) {
      const hit = entries.find(({ entry, nodes }) => {
        if (UNALLOWABLE.has(f.code) || !codeMatches(f.code, entry.checks)) return false;
        if (!under(nodeOf.get(f), nodes)) return false;
        if (!entry.beats) return true;
        const spans = entry.beats.map(span);
        return f.frames.every((r) => spans.some((s) => r.from >= s.from && r.to <= s.to));
      });
      if (hit) allowed.push({ ...f, reason: hit.entry.reason });
      else kept.push(f);
    }
    // Always: a stale entry is a problem in the checks file, whatever ran.
    for (const { entry, nodes } of entries) {
      if (nodes.size > 0) continue;
      kept.push({
        code: "allow/no-match",
        severity: "warning",
        held: false,
        message: messageFor("allow/no-match", { select: entry.select }),
        composition: comp.id(),
        node: null,
        frames: [],
        beats: [],
        source: null,
        details: { select: entry.select },
      });
    }
    return { findings: sortFindings(kept), allowed, samples: ctx.samples.length, colorsInUse };
  } finally {
    goTo(comp, startFrame);
  }
}
