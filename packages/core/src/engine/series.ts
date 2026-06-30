import { computeOffsets, type OffsetScene, type PlacedScene } from "./offsets.js";
import { Sequence, type SequenceProvider } from "./sequence.js";

export type SeriesOptions = {
  /** Frame the series starts at. Default `0`. */
  from?: number;
};

export type SeriesSceneOptions = {
  durationInFrames: number;
  /**
   * Frames added to the previous scene's end before this scene starts. Negative
   * overlaps the previous scene; positive leaves a gap. Default `0` (back-to-back).
   */
  offset?: number;
};

type SceneDef = {
  opts: SeriesSceneOptions;
  build: (seq: Sequence) => void;
};

/**
 * Sequential sequencer: collects ordered scenes and auto-computes each
 * `Sequence`'s `from`, so callers never hand-compute offsets. Mirrors Remotion's
 * `<Series>` / `<Series.Sequence>`.
 *
 * ```ts
 * const series = new Series({ from: 0 });
 * series
 *   .add({ durationInFrames: 60 }, (seq) => seq.add(rect))
 *   .add({ durationInFrames: 90, offset: -10 }, (seq) => seq.add(circle));
 * composition.add(series); // adds each sequence the series yields
 * series.durationInFrames; // total span accounting for offsets
 * ```
 */
export class Series implements SequenceProvider {
  readonly from: number;
  private readonly _scenes: SceneDef[] = [];

  constructor(opts: SeriesOptions = {}) {
    const from = opts.from ?? 0;
    if (!Number.isInteger(from) || from < 0) {
      throw new Error("Series: from must be a non-negative integer");
    }
    this.from = from;
  }

  /** Append a scene. The `build` callback populates the created `Sequence`. */
  add(opts: SeriesSceneOptions, build: (seq: Sequence) => void): this {
    this._scenes.push({ opts, build });
    return this;
  }

  private _place(): PlacedScene[] {
    const scenes: OffsetScene[] = this._scenes.map((s) => ({
      durationInFrames: s.opts.durationInFrames,
      offset: s.opts.offset,
    }));
    return computeOffsets(scenes, this.from).placed;
  }

  /** Build one `Sequence` per scene, with `from` resolved from the offsets. */
  sequences(): Sequence[] {
    const placed = this._place();
    return placed.map((p, i) => {
      const def = this._scenes[i];
      const seq = new Sequence({ from: p.from, durationInFrames: p.durationInFrames });
      def?.build(seq);
      return seq;
    });
  }

  /** Total span of the series, `max(from + duration) − series.from`. */
  get durationInFrames(): number {
    const scenes: OffsetScene[] = this._scenes.map((s) => ({
      durationInFrames: s.opts.durationInFrames,
      offset: s.opts.offset,
    }));
    return computeOffsets(scenes, this.from).durationInFrames;
  }
}
