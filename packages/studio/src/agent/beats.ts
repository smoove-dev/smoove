import { type Beat, withSheetFrames } from "@smoove/agent";
import type { Composition } from "@smoove/core";
import { inferKind, sequencesOf, stripPrefix } from "../hooks/use-layers.js";

/**
 * The composition's beats: its plan's markers, or its top-level sequences
 * when it has no plan (audio and transitions left out).
 */
export function beatsOf(comp: Composition): { from: "plan" | "sequences"; beats: Beat[] } {
  const total = comp.durationInFrames.get();
  const plan = comp.plan;
  if (plan && Object.keys(plan).length > 0) {
    const raw = Object.entries(plan).map(([name, m]) => ({
      name: m.name ?? name,
      start: m.start.resolve(),
      settled: m.settled.resolve(),
      end: m.end.resolve(),
    }));
    return { from: "plan", beats: withSheetFrames(raw, total) };
  }
  const raw = sequencesOf(comp)
    .map((s, i) => {
      const label = s.name() || s.id() || "";
      return {
        kind: inferKind(label),
        name: stripPrefix(label) || `sequence ${i + 1}`,
        start: s.from,
        settled: s.from,
        end: Math.min(s.from + s.durationInFrames, total),
      };
    })
    .filter((b) => b.kind !== "audio" && b.kind !== "transition" && b.end > b.start)
    .map(({ kind: _kind, ...b }) => b);
  return { from: "sequences", beats: withSheetFrames(raw, total) };
}

/** The first beat that contains `frame` (start at or before it, end after it), or null. */
export function beatAt(beats: Beat[], frame: number): string | null {
  return beats.find((b) => b.start <= frame && frame < b.end)?.name ?? null;
}
