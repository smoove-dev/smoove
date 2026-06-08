/**
 * Sequential offset engine shared by `Series` (auto-offsets) and
 * `TransitionSeries` (offsets with overlap). Pure and deterministic: the same
 * scene list + start frame always yields the same placements, so it is safe for
 * offline / server rendering.
 *
 * @module
 */

/** A scene to place: its length, plus an optional delta from the previous end. */
export type OffsetScene = {
  durationInFrames: number;
  /**
   * Frames added to the previous scene's end before this scene starts. `0`
   * (default) butts scenes back-to-back; positive leaves a gap; negative
   * overlaps (e.g. a transition overlapping the outgoing scene).
   */
  offset?: number;
};

/** A scene after placement — where it starts and how long it runs. */
export type PlacedScene = { from: number; durationInFrames: number };

export type ComputeOffsetsResult = {
  placed: PlacedScene[];
  /** `max(from + durationInFrames) − seriesFrom` — the total span of the series. */
  durationInFrames: number;
};

/**
 * Chain `scenes` from `seriesFrom`, computing each scene's `from` as
 * `previousEnd + offset`. The first scene starts at `seriesFrom + offset`.
 *
 * A computed `from` may never fall below `seriesFrom` or below 0 — a negative
 * `offset` that would underflow throws.
 *
 * @internal Engine util reused by `Series` and `@konva-motion/transitions`.
 */
export function computeOffsets(scenes: OffsetScene[], seriesFrom = 0): ComputeOffsetsResult {
  if (!Number.isInteger(seriesFrom) || seriesFrom < 0) {
    throw new Error("Series: from must be a non-negative integer");
  }
  if (scenes.length === 0) {
    throw new Error("Series: add at least one scene before reading sequences");
  }

  const placed: PlacedScene[] = [];
  let previousEnd = seriesFrom;
  let maxEnd = seriesFrom;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene === undefined) continue;
    const { durationInFrames } = scene;
    const offset = scene.offset ?? 0;
    if (!Number.isInteger(durationInFrames) || durationInFrames <= 0) {
      throw new Error(
        `Series: scene ${i} durationInFrames must be a positive integer (got ${durationInFrames})`,
      );
    }
    if (!Number.isInteger(offset)) {
      throw new Error(`Series: scene ${i} offset must be an integer (got ${offset})`);
    }
    const from = previousEnd + offset;
    if (from < seriesFrom) {
      throw new Error(
        `Series: scene ${i} offset ${offset} pushes from (${from}) before the series start (${seriesFrom})`,
      );
    }
    if (from < 0) {
      throw new Error(`Series: scene ${i} offset ${offset} pushes from (${from}) below 0`);
    }
    placed.push({ from, durationInFrames });
    previousEnd = from + durationInFrames;
    if (previousEnd > maxEnd) maxEnd = previousEnd;
  }

  return { placed, durationInFrames: maxEnd - seriesFrom };
}
