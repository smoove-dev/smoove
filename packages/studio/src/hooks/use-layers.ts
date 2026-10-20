import { type Composition, Sequence } from "@smoove/core";
import type { LayerKind } from "../lib/constants.js";
import { clamp01 } from "../lib/format.js";
import type { StudioLayer } from "../types.js";

const KIND_RE = /^(audio|video|group|transition|sequence):/i;

export function inferKind(name: string): LayerKind {
  const m = KIND_RE.exec(name);
  return (m?.[1]?.toLowerCase() as LayerKind | undefined) ?? "sequence";
}

export const stripPrefix = (name: string): string => name.replace(KIND_RE, "").trim();

/** Top-level `Sequence`s of a composition, in tree order. */
export function sequencesOf(comp: Composition): Sequence[] {
  return comp.getChildren((n) => n instanceof Sequence) as Sequence[];
}

/**
 * The name of the plan beat that spans exactly `from` to `end`, if the
 * composition registered a plan. A scene from a series has no name of its
 * own; its beat does.
 */
export function beatNameFor(comp: Composition, from: number, end: number): string | null {
  const plan = comp.plan;
  if (!plan) return null;
  for (const [key, marker] of Object.entries(plan)) {
    try {
      if (marker.start.resolve() === from && marker.end.resolve() === end)
        return marker.name ?? key;
    } catch {
      // A marker that can't resolve yet names nothing.
    }
  }
  return null;
}

/** Derive timeline tracks from a composition's top-level Sequences. */
export function deriveLayers(comp: Composition): StudioLayer[] {
  const total = comp.durationInFrames.get() || 1;
  return sequencesOf(comp).map((s, i) => {
    const raw =
      s.name() ||
      s.id() ||
      beatNameFor(comp, s.from, s.from + s.durationInFrames) ||
      `Layer ${i + 1}`;

    return {
      name: stripPrefix(raw) || `Layer ${i + 1}`,
      kind: inferKind(raw),
      start: clamp01(s.from / total),
      end: clamp01((s.from + s.durationInFrames) / total),
    };
  });
}

/** Apply per-layer enable/disable to the real Konva Sequences (opacity). */
export function applyLayerVisibility(comp: Composition, off: Set<number>): void {
  const seqs = sequencesOf(comp);

  seqs.forEach((s, i) => {
    s.opacity(off.has(i) ? 0 : 1);
  });

  comp.batchDraw();
}
