import type { Composition } from "../engine/composition.js";
import { type CheckBeat, sweepStride } from "./findings.js";

type Range = { name: string; start: number; settled: number; end: number };

/**
 * The last frame a beat holds before the next one comes in, and the frame a
 * contact sheet shows for it: two thirds of the way there from its settled
 * frame, so entrances are done and an exit at its end hasn't begun. The same
 * rules as `heldToFrame` and `sheetFrame` in `@smoove/agent`.
 */
function framesOf(
  beat: Range,
  nextStart: number | null,
  total: number,
): { heldTo: number; sheet: number } {
  const stop =
    nextStart != null && nextStart > beat.start ? Math.min(beat.end, nextStart) : beat.end;
  const heldTo = Math.max(beat.start, Math.min(Math.min(stop, total) - 1, total - 1), 0);
  const from = Math.min(Math.max(beat.start, beat.settled), heldTo);
  return { heldTo, sheet: from + Math.round(((heldTo - from) * 2) / 3) };
}

function withSheets(ranges: Range[], total: number): CheckBeat[] {
  const ordered = [...ranges].sort((a, b) => a.start - b.start);
  return ranges.map((r) => {
    const i = ordered.indexOf(r);
    const next = ordered.slice(i + 1).find((n) => n.start > r.start);
    return { ...r, ...framesOf(r, next?.start ?? null, total) };
  });
}

/**
 * The composition's beats: its plan's markers, or its top-level sequences
 * when it has no plan. The studio passes its own beats (the ones
 * `smoove timeline` prints), so this is the default for tests.
 */
export function checkBeats(comp: Composition): CheckBeat[] {
  const total = comp.durationInFrames.get();
  const plan = comp.plan;
  if (plan && Object.keys(plan).length > 0) {
    return withSheets(
      Object.entries(plan).map(([name, m]) => ({
        name: m.name ?? name,
        start: m.start.resolve(),
        settled: m.settled.resolve(),
        end: m.end.resolve(),
      })),
      total,
    );
  }
  const sequences = comp
    .getChildren()
    .filter(
      (c) =>
        typeof (c as { from?: unknown }).from === "number" &&
        typeof (c as { durationInFrames?: unknown }).durationInFrames === "number",
    ) as unknown as Array<{ name(): string; id(): string; from: number; durationInFrames: number }>;
  return withSheets(
    sequences
      .map((s, i) => ({
        name: s.name() || s.id() || `sequence ${i + 1}`,
        start: s.from,
        settled: s.from,
        end: Math.min(s.from + s.durationInFrames, total),
      }))
      .filter((r) => r.end > r.start),
    total,
  );
}

/**
 * The frames a sweep visits, ascending and without repeats: every tenth of a
 * second for the sweep or every half second for contrast, plus every beat's
 * start, settled, sheet and held-to frames, the first frame and the last.
 */
export function sampleFrames(
  durationInFrames: number,
  fps: number,
  beats: CheckBeat[],
  kind: "sweep" | "contrast",
): number[] {
  const stride = kind === "sweep" ? sweepStride(fps) : Math.max(1, Math.round(fps / 2));
  const last = durationInFrames - 1;
  const set = new Set<number>([0, last]);
  for (let f = 0; f <= last; f += stride) set.add(f);
  for (const b of beats) {
    for (const f of [b.start, b.settled, b.sheet, b.heldTo ?? b.sheet])
      if (f >= 0 && f <= last) set.add(f);
  }
  return [...set].sort((a, b) => a - b);
}

/** Whether `frame` sits on some beat's held stretch (settled to heldTo, both included). */
export function isHeldFrame(frame: number, beats: CheckBeat[]): boolean {
  return beats.some((b) => frame >= b.settled && frame <= (b.heldTo ?? b.sheet));
}
