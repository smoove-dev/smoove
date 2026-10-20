/** Plain-text output of every command: what a person or an agent reads. */
import {
  type AgentResponse,
  type CheckData,
  type CheckFinding,
  type ContextData,
  type DrawnBy,
  MARK_MIN_COVER,
  type MarkRect,
  type SeekData,
  type SheetData,
  type SnapshotData,
  type StatusData,
  type TimelineData,
  type TimelineNode,
} from "../index.js";
import type { LintFinding } from "../lint/lint.js";

function who(by: DrawnBy | undefined): string {
  if (!by) return "";
  return by.headless ? "the headless tab" : `the user's tab at ${by.path}`;
}

export function range(start: number, end: number): string {
  return end - 1 > start ? `frames ${start} to ${end - 1}` : `frame ${start}`;
}

export function formatStatus(data: StatusData): string {
  const lines = [`Studio: ${data.server.url}`];
  const users = data.server.tabs.filter((t) => !t.owned);
  const owned = data.server.tabs.some((t) => t.owned);
  lines.push(
    `Tabs: ${users.length === 0 ? "no user tab" : `${users.length} user tab${users.length === 1 ? "" : "s"}`}${owned ? ", plus the headless tab" : ""}`,
  );
  const active = data.studio?.active;
  if (!data.studio) {
    lines.push(`Nobody has the studio open. Give the user this URL: ${data.openUrl}`);
  } else if (!active) {
    lines.push("The user's tab has no composition open.");
  } else if (active.loadStatus === "error") {
    lines.push(`Showing ${active.id}, which failed to build: ${active.error}`);
  } else {
    const parts = [`Showing ${active.id}`];
    if (active.frame != null && active.durationInFrames != null) {
      parts.push(`frame ${active.frame} of frames 0 to ${active.durationInFrames - 1}`);
    }
    if (active.fps != null) parts.push(`${active.fps} fps`);
    if (active.width != null) parts.push(`${active.width} by ${active.height}`);
    parts.push(active.playing ? "playing" : "paused");
    if (active.assets === "buffering" || active.loadStatus === "loading")
      parts.push("still loading");
    lines.push(parts.join(", "));
  }
  if (data.studio) lines.push(`Compositions: ${data.studio.catalog.map((c) => c.id).join(", ")}`);
  const mark = data.server.mark;
  if (mark) {
    lines.push(
      `A mark is waiting on ${mark.composition}, frame ${mark.frame}. Run smoove context.`,
    );
  }
  return lines.join("\n");
}

function at(r: MarkRect): string {
  const n = (v: number) => String(Math.round(v));
  return `${n(r.x)},${n(r.y)} size ${n(r.width)} by ${n(r.height)}`;
}

/** The user's mark: the frame, the image, then the covered nodes, smallest first. */
export function formatContext(data: ContextData): string {
  const mark = data.mark;
  if (!mark) {
    return "No mark. Ask the user to drag a rectangle over the thing they mean in the studio.";
  }
  const beat = mark.beat ? ` (beat: ${mark.beat})` : "";
  const lines = [
    `Mark on ${mark.composition}, frame ${mark.frame}${beat}, rectangle at ${at(mark.rect)}.`,
    `Image: ${mark.image ?? "none"}`,
    "",
  ];
  const below = `No node is more than ${Math.round(MARK_MIN_COVER * 100)} percent inside the rectangle.`;
  if (mark.nodes.length === 0) lines.push(`${below} Look at the image.`);
  else if (mark.closest) lines.push(`${below} These come closest:`);
  mark.nodes.forEach((node, i) => {
    const label = node.name ?? node.id ?? "unnamed";
    const text = node.text != null ? ` ${JSON.stringify(node.text)}` : "";
    lines.push(
      `${i + 1}. ${label} (${node.type}${text}), ${Math.round(node.cover * 100)}% inside, box ${at(node.box)}`,
    );
    const src = node.source;
    if (src) {
      lines.push(`   ${src.file}:${src.line}:${src.column}${src.inherited ? " (inherited)" : ""}`);
    }
    if (node.ancestors.length > 0) lines.push(`   in ${[...node.ancestors].reverse().join(", ")}`);
  });
  return lines.join("\n");
}

export function formatSeek(data: SeekData): string {
  return `The user's tab now shows ${data.composition} at frame ${data.frame}.`;
}

export function formatSnap(data: SnapshotData, answer: AgentResponse<SnapshotData>): string {
  return `${data.path}\n${data.composition}, frame ${data.frame}, ${data.width} by ${data.height}, drawn by ${who(answer.drawnBy)}.`;
}

export function formatSheet(data: SheetData, answer: AgentResponse<SheetData>): string {
  const how = data.mode === "beats" ? "one tile per beat" : "evenly spaced frames";
  const tiles = data.tiles.map((t) => (t.beat ? `${t.frame} ${t.beat}` : String(t.frame)));
  return [
    data.path,
    `${data.composition}, ${data.tiles.length} tiles, ${how}, each ${data.tileWidth} by ${data.tileHeight}, drawn by ${who(answer.drawnBy)}.`,
    `Frames: ${tiles.join(", ")}`,
  ].join("\n");
}

export function formatTimeline(data: TimelineData): string {
  const lines = [
    `${data.composition}: ${data.width} by ${data.height}, ${data.fps} fps, ${data.durationInFrames} frames (frames 0 to ${data.durationInFrames - 1})`,
  ];
  if (data.beats.length > 0) {
    lines.push(
      data.beatsFrom === "plan" ? "Beats, from the plan:" : "Beats, from the top-level sequences:",
    );
    for (const b of data.beats) {
      const settled = b.settled !== b.start ? `, settled at ${b.settled}` : "";
      lines.push(`  ${b.name}: ${range(b.start, b.end)}${settled}, sheet frame ${b.sheet}`);
    }
  }
  lines.push("Sequences:");
  const walk = (nodes: TimelineNode[], depth: number): void => {
    for (const n of nodes) {
      lines.push(`${"  ".repeat(depth)}${n.name} (${n.kind}): ${range(n.start, n.end)}`);
      walk(n.children, depth + 1);
    }
  };
  walk(data.sequences, 1);
  return lines.join("\n");
}

/** Node text in a check report is cut to this many characters. */
const CHECK_TEXT_SHOWN = 34;

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function frameText(f: CheckFinding): string | null {
  if (f.frames.length === 0) return null;
  const ranges = f.frames.map((r) =>
    r.to > r.from ? `frames ${r.from} to ${r.to}` : `frame ${r.from}`,
  );
  const beats =
    f.beats.length === 0 ? "" : `${f.beats.length === 1 ? "beat" : "beats"} ${listOf(f.beats)}`;
  const tail = beats
    ? f.held
      ? `, held through ${beats}`
      : `, passing, in ${beats}`
    : f.held
      ? ", held"
      : ", passing";
  return `${ranges.join(", ")}${tail}`;
}

function nodeText(f: CheckFinding): string {
  const n = f.node;
  if (!n) return "";
  const label = n.name ?? (n.id ? `#${n.id}` : "an unnamed node");
  const text =
    n.text === undefined
      ? ""
      : ` "${n.text.length > CHECK_TEXT_SHOWN ? `${n.text.slice(0, CHECK_TEXT_SHOWN)}…` : n.text}"`;
  return `: ${label} (${n.type}${text})`;
}

export function findingLines(f: CheckFinding): string[] {
  const lines = [`${f.severity} ${f.code}${nodeText(f)}`];
  const frames = frameText(f);
  if (frames) lines.push(`  ${frames}`);
  if (f.source) {
    lines.push(
      `  ${f.source.file}:${f.source.line}:${f.source.column}${f.source.inherited ? " (inherited)" : ""}`,
    );
  }
  lines.push(`  ${f.message}`);
  if (f.image) lines.push(`  Image: ${f.image}`);
  return lines;
}

export const lintAsFinding = (l: LintFinding, composition: string): CheckFinding => ({
  code: l.code,
  severity: "warning",
  held: false,
  message: l.message,
  composition,
  node: null,
  frames: [],
  beats: [],
  source: l.source,
});

/** A check report for one composition, with the lint's findings after the tab's. */
export function formatCheck(data: CheckData, lint: LintFinding[]): string {
  const all = [...data.findings, ...lint.map((l) => lintAsFinding(l, data.composition))];
  const errors = all.filter((f) => f.severity === "error").length;
  const warnings = all.length - errors;
  const head = `Checked ${data.composition}: ${data.frames} frames, ${plural(data.beats, "beat")}, ${data.samples} samples.`;
  const counts =
    all.length === 0
      ? "No errors and no warnings."
      : `${plural(errors, "error")}, ${plural(warnings, "warning")}${data.allowed.length > 0 ? `, ${data.allowed.length} allowed` : ""}.`;
  const lines = [`${head} ${counts}`];
  if (!data.hasChecksFile) lines.push(`${data.composition} has no checks file.`);
  if (!data.hasPalette && data.colorsInUse.length > 0) {
    lines.push(`Colors in use, most used first: ${data.colorsInUse.join(", ")}.`);
  }
  for (const f of all) lines.push("", ...findingLines(f));
  return lines.join("\n");
}
