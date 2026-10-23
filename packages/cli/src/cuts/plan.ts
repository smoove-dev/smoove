/**
 * `cut_plan`: turn editing choices into the exact ranges of the source a
 * recut plays, written to `compositions/<id>/cuts.json`. It decides nothing
 * itself: the agent says what to keep or drop, and this makes it exact.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CutPlan, CutSegment, TimeRange, TranscriptWord } from "@smoove/agent";
import { type CommandResult, type RunContext, spell, UsageError } from "../commands.js";
import { readAudioMap } from "../media/audio-map.js";
import { MediaError, writeAtomic } from "../media/cache.js";
import { cachedInfo } from "../media/info.js";
import { clock, runMedia } from "../media/runtime.js";
import { done } from "../run.js";
import { readTranscriptFor } from "../transcribe/where.js";

/** Measured in Task 0: preview stayed clean at 50 Video nodes on one file and broke at 60. */
export const MAX_RECUT_SEGMENTS = 48;
const DEFAULT_PAD = 0.1;
const SHORT = 0.5;

export interface CutInput {
  duration: number;
  fps: number;
  keep?: CutSegment[];
  remove?: TimeRange[];
  words?: TranscriptWord[];
  quiet?: TimeRange[];
  fillers?: string[];
  maxPause?: number;
  pad?: number;
  target?: number;
}

/** A kept piece, the range it came from, and which edges a cut created. */
interface Piece {
  start: number;
  end: number;
  label?: string;
  /** The explicit range it came from: padding never goes past it. */
  min: number;
  max: number;
  padStart: boolean;
  padEnd: boolean;
}

const clean = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, "");
const fmt = (t: number) => String(Math.round(t * 1000) / 1000);

function merge(pieces: Piece[]): Piece[] {
  const sorted = [...pieces].sort((a, b) => a.start - b.start);
  const out: Piece[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && p.start <= last.end) {
      if (p.end > last.end) {
        last.end = p.end;
        last.padEnd = p.padEnd;
        last.max = Math.max(last.max, p.max);
      }
    } else out.push({ ...p });
  }
  return out;
}

/**
 * Take `cut` out of every piece. Edges a shortened pause leaves can be padded
 * back into the pause; edges a dropped word leaves can't, or the padding
 * would put the word back.
 */
function subtract(pieces: Piece[], cut: TimeRange, paddable = true): Piece[] {
  return pieces.flatMap((p) => {
    if (cut.end <= p.start || cut.start >= p.end) return [p];
    const out: Piece[] = [];
    if (cut.start > p.start) out.push({ ...p, end: cut.start, padEnd: paddable });
    if (cut.end < p.end) out.push({ ...p, start: cut.end, padStart: paddable });
    return out;
  });
}

export function planCuts(input: CutInput): {
  segments: CutSegment[];
  seconds: number;
  warnings: string[];
} {
  const { duration, fps } = input;
  const warnings: string[] = [];

  // 1. The starting ranges.
  let pieces: Piece[];
  if (input.keep?.length) {
    pieces = merge(
      input.keep.map((k) => ({
        start: k.start,
        end: k.end,
        ...(k.label ? { label: k.label } : {}),
        min: k.start,
        max: k.end,
        padStart: false,
        padEnd: false,
      })),
    );
  } else {
    pieces = [{ start: 0, end: duration, min: 0, max: duration, padStart: false, padEnd: false }];
    for (const r of [...(input.remove ?? [])].sort((a, b) => a.start - b.start)) {
      pieces = subtract(pieces, r).map((p) => ({
        ...p,
        // A remove edge is explicit: never padded, and the bound padding stops at.
        padStart: p.start === r.end ? false : p.padStart,
        padEnd: p.end === r.start ? false : p.padEnd,
        min: p.start === r.end ? r.end : p.min,
        max: p.end === r.start ? r.start : p.max,
      }));
    }
  }

  // 2. Filler words.
  const fillers = new Set((input.fillers ?? []).map(clean));
  const isFiller = (w: TranscriptWord) => fillers.has(clean(w.text));
  for (const w of input.words ?? []) if (isFiller(w)) pieces = subtract(pieces, w, false);

  // 3. Long pauses, shortened to maxPause.
  if (input.maxPause !== undefined) {
    const half = input.maxPause / 2;
    for (const q of input.quiet ?? []) {
      if (q.end - q.start <= input.maxPause) continue;
      if (!pieces.some((p) => q.start >= p.start && q.end <= p.end)) continue;
      pieces = subtract(pieces, { start: q.start + half, end: q.end - half });
    }
  }

  // 4. Padding on the edges steps 2 and 3 made.
  const pad = input.pad ?? (input.words?.length || input.quiet?.length ? DEFAULT_PAD : 0);
  if (pad > 0) {
    pieces = merge(
      pieces.map((p) => ({
        ...p,
        start: p.padStart ? Math.max(p.min, p.start - pad) : p.start,
        end: p.padEnd ? Math.min(p.max, p.end + pad) : p.end,
      })),
    );
  }

  // 5. Never split a kept word.
  const kept = (input.words ?? []).filter((w) => !isFiller(w));
  const outward = (t: number, side: "start" | "end") => {
    const word = kept.find((w) => t > w.start && t < w.end);
    if (!word) return t;
    const moved = side === "start" ? word.start : word.end;
    warnings.push(`Moved a cut at ${fmt(t)} to ${fmt(moved)} so it doesn't split "${word.text}".`);
    return moved;
  };
  pieces = merge(
    pieces.map((p) => ({ ...p, start: outward(p.start, "start"), end: outward(p.end, "end") })),
  );

  // 6. The frame grid.
  const snap = (t: number) => Math.min(duration, Math.max(0, Math.round(t * fps) / fps));
  const segments: CutSegment[] = pieces
    .map((p) => ({
      start: snap(p.start),
      end: snap(p.end),
      ...(p.label ? { label: p.label } : {}),
    }))
    .filter((s) => s.end > s.start);
  const seconds = Math.round(segments.reduce((a, s) => a + s.end - s.start, 0) * 1000) / 1000;

  // 7. Warnings.
  for (const s of segments) {
    if (s.end - s.start < SHORT) {
      warnings.push(`The segment ${fmt(s.start)} to ${fmt(s.end)} is shorter than half a second.`);
    }
  }
  if (segments.length > MAX_RECUT_SEGMENTS) {
    warnings.push(
      `${segments.length} segments is more than ${MAX_RECUT_SEGMENTS}, past which the studio preview can run out of video decoders. Split the edit into more than one composition.`,
    );
  }
  if (input.target !== undefined) {
    if (seconds > input.target) {
      warnings.push(
        `The cut runs ${fmt(seconds)} seconds, over the ${fmt(input.target)} second target.`,
      );
    } else if (seconds < input.target * 0.9) {
      warnings.push(
        `The cut runs ${fmt(seconds)} seconds, well short of the ${fmt(input.target)} second target.`,
      );
    }
  }
  return { segments, seconds, warnings };
}

export interface CutPlanInput {
  composition: string;
  keep?: CutSegment[];
  remove?: TimeRange[];
  fillers?: string[];
  maxPause?: number;
  pad?: number;
  target?: number;
}

export function runCutPlan(ctx: RunContext, input: CutPlanInput): Promise<CommandResult> {
  return runMedia(ctx, async (root) => {
    const file = join(root, "compositions", input.composition, "cuts.json");
    if (!existsSync(file)) {
      throw new UsageError(
        `compositions/${input.composition} has no cuts.json. Make it with smoove new --template recut first.`,
      );
    }
    if (input.keep?.length && input.remove?.length) {
      throw new UsageError("Give the ranges to keep or the ranges to remove, not both.");
    }
    const current = JSON.parse(readFileSync(file, "utf8")) as CutPlan;
    if (!existsSync(join(root, current.source))) {
      throw new MediaError(
        "not-found",
        `${current.source} isn't here. footage/ is kept out of git, so a fresh clone has none: bring the recording back with ${spell(ctx, "footage_add")}, and this plan plays as before.`,
      );
    }
    const info = await cachedInfo(root, current.source);
    const words = readTranscriptFor(root, current.source)?.words;
    if (input.fillers?.length && !words) {
      throw new UsageError(
        `Dropping filler words needs a transcript. Run transcribe on ${current.source} first.`,
      );
    }
    const quiet =
      input.maxPause !== undefined ? (await readAudioMap(root, current.source)).quiet : undefined;
    const { segments, seconds, warnings } = planCuts({
      duration: info.duration,
      fps: current.fps,
      keep: input.keep,
      remove: input.remove,
      words,
      quiet,
      fillers: input.fillers,
      maxPause: input.maxPause,
      pad: input.pad,
      target: input.target,
    });
    const plan: CutPlan = { source: current.source, fps: current.fps, segments, seconds };
    writeAtomic(file, `${JSON.stringify(plan, null, 2)}\n`);
    const shown = segments
      .slice(0, 12)
      .map((s) => `${clock(s.start, 1)} to ${clock(s.end, 1)}${s.label ? ` (${s.label})` : ""}`);
    const result = done(plan, [
      `compositions/${input.composition}/cuts.json: ${segments.length} segment${segments.length === 1 ? "" : "s"} of ${current.source}, ${clock(seconds, 1)} in all.`,
      `${shown.join(", ")}${segments.length > 12 ? `, and ${segments.length - 12} more` : ""}.`,
      `${current.source} is unchanged.`,
    ]);
    result.errors = warnings.map((w) => `Warning: ${w}`).join("\n");
    return result;
  });
}
