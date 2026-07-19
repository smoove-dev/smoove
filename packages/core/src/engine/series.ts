import {
  type FrameAnchor,
  Marker,
  type MarkerSource,
  resolveFrameAnchor,
  type ScenePlacement,
} from "./marker.js";
import { computeOffsets, type OffsetScene, type PlacedScene } from "./offsets.js";
import { Sequence, type SequenceProvider } from "./sequence.js";

export type SeriesOptions = {
  /**
   * Frame the series starts at: an absolute frame or a `Marker`/`MarkerPoint`
   * (e.g. another series' marker), resolved live. Default `0`.
   */
  from?: FrameAnchor;
};

export type SeriesSceneOptions = {
  durationInFrames: number;
  /**
   * Frames added to the previous scene's end before this scene starts. Negative
   * overlaps the previous scene; positive leaves a gap. Default `0` (back-to-back).
   */
  offset?: number;
  /** Optional scene name for `series.marker(name)`. Unique per series. */
  name?: string;
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
export class Series implements SequenceProvider, MarkerSource {
  private readonly _from: FrameAnchor;
  private readonly _scenes: SceneDef[] = [];

  constructor(opts: SeriesOptions = {}) {
    const from = opts.from ?? 0;
    if (typeof from === "number" && (!Number.isInteger(from) || from < 0)) {
      throw new Error("Series: from must be a non-negative integer");
    }
    this._from = from;
  }

  /** Frame the series starts at. Marker-valued `from` resolves on every read. */
  get from(): number {
    return resolveFrameAnchor(this._from);
  }

  /** Append a scene. The `build` callback populates the created `Sequence`. */
  add(opts: SeriesSceneOptions, build: (seq: Sequence) => void): this {
    if (opts.name !== undefined && this._scenes.some((s) => s.opts.name === opts.name)) {
      throw new Error(`Series: duplicate scene name "${opts.name}"`);
    }
    this._scenes.push({ opts, build });
    return this;
  }

  /**
   * A lazily-resolving {@link Marker} onto the named scene. Resolution runs
   * this series' placement at read time, so retiming any earlier scene moves
   * the marker — and everything anchored to it — automatically.
   */
  marker(name: string): Marker {
    if (typeof name !== "string" || name.length === 0) {
      throw new Error("Series: marker name must be a non-empty string");
    }
    return new Marker(this, name);
  }

  /** @internal marker-source hook. `settled` = start + `max(0, −offset)`. */
  _kmResolveMarker(name: string | undefined): ScenePlacement {
    const i = this._scenes.findIndex((s) => s.opts.name === name);
    if (name === undefined || i < 0) {
      const names = this._scenes
        .map((s) => s.opts.name)
        .filter((n): n is string => n !== undefined);
      throw new Error(
        `Series: no scene named "${name}" (named scenes: ${names.length > 0 ? names.join(", ") : "none"})`,
      );
    }
    const placed = this._place();
    const p = placed[i];
    if (!p) throw new Error(`Series: scene "${name}" has no placement`);
    const offset = this._scenes[i]?.opts.offset ?? 0;
    return {
      from: p.from,
      end: p.from + p.durationInFrames,
      settled: p.from + Math.max(0, -offset),
    };
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
