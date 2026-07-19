import {
  type Composition,
  computeOffsets,
  type FrameAnchor,
  Marker,
  type MarkerSource,
  type OffsetScene,
  type PlacedScene,
  resolveFrameAnchor,
  type ScenePlacement,
  Sequence,
  type SequenceProvider,
} from "@smoove/core";
import Konva from "konva";
import { getCompositor } from "./gl/compositor.js";
import { fade } from "./presentations/fade.js";
import type { Presentation, PresentationDims, Timing } from "./types.js";

export type TransitionSeriesOptions = {
  /**
   * The Composition the series will be added to. Needed up front because spring
   * timings resolve their length from `fps`, and presentations are sized from
   * the stage `width`/`height`. (Diverges from Remotion, which reads these from
   * React context.)
   */
  composition: Composition;
  /**
   * Frame the series starts at: an absolute frame or a `Marker`/`MarkerPoint`,
   * resolved live. Default `0`.
   */
  from?: FrameAnchor;
};

export type TransitionSeriesSceneOptions = {
  durationInFrames: number;
  /** Optional scene name for `transitionSeries.marker(name)`. Unique per series. */
  name?: string;
};

export type TransitionSeriesTransitionOptions = {
  presentation: Presentation;
  timing: Timing;
};

type SceneItem = {
  kind: "scene";
  name?: string;
  durationInFrames: number;
  build: (seq: Sequence) => void;
};

/** A scene flattened out of the item list, carrying its adjacent transitions. */
type SceneRecord = {
  name?: string;
  durationInFrames: number;
  build: (seq: Sequence) => void;
  incoming?: { presentation: Presentation; timing: Timing; duration: number };
  outgoing?: { presentation: Presentation; timing: Timing; duration: number };
};
type TransitionItem = {
  kind: "transition";
  presentation: Presentation;
  timing: Timing;
};
type Item = SceneItem | TransitionItem;

let warnedNoWebGl = false;

/** Reset a layer's transform to identity (used between/around transitions). */
function resetLayer(layer: Konva.Layer): void {
  layer.opacity(1);
  layer.position({ x: 0, y: 0 });
  layer.scale({ x: 1, y: 1 });
  layer.rotation(0);
  if (layer.getAttr("clipFunc")) layer.setAttr("clipFunc", undefined);
}

/**
 * Sequential sequencer where adjacent scenes overlap by a transition's
 * `durationInFrames`. Built on the same offset engine as `Series` — a
 * transition is just a sequential step with a negative (overlap) delta. Mirrors
 * Remotion's `<TransitionSeries>`.
 *
 * ```ts
 * const series = new TransitionSeries({ composition });
 * series.scene({ durationInFrames: 60 }, (seq) => seq.add(sceneA));
 * series.transition({ presentation: fade(), timing: linearTiming({ durationInFrames: 15 }) });
 * series.scene({ durationInFrames: 90 }, (seq) => seq.add(sceneB));
 * composition.add(series);
 * ```
 */
export class TransitionSeries implements SequenceProvider, MarkerSource {
  private readonly _from: FrameAnchor;
  private readonly composition: Composition;
  private readonly _items: Item[] = [];

  constructor(opts: TransitionSeriesOptions) {
    const from = opts.from ?? 0;
    if (typeof from === "number" && (!Number.isInteger(from) || from < 0)) {
      throw new Error("TransitionSeries: from must be a non-negative integer");
    }
    this.composition = opts.composition;
    this._from = from;
  }

  /** Frame the series starts at. Marker-valued `from` resolves on every read. */
  get from(): number {
    return resolveFrameAnchor(this._from);
  }

  scene(opts: TransitionSeriesSceneOptions, build: (seq: Sequence) => void): this {
    if (!Number.isInteger(opts.durationInFrames) || opts.durationInFrames <= 0) {
      throw new Error("TransitionSeries: scene durationInFrames must be a positive integer");
    }
    if (opts.name !== undefined) {
      const dup = this._items.some((it) => it.kind === "scene" && it.name === opts.name);
      if (dup) throw new Error(`TransitionSeries: duplicate scene name "${opts.name}"`);
    }
    this._items.push({
      kind: "scene",
      name: opts.name,
      durationInFrames: opts.durationInFrames,
      build,
    });
    return this;
  }

  /**
   * A lazily-resolving {@link Marker} onto the named scene. `start` is the
   * frame the scene's window opens (its incoming transition begins);
   * `settled` is start + the incoming transition's duration (scene fully
   * revealed); `end` is the window close. Retiming scenes *or transitions*
   * moves all three.
   */
  marker(name: string): Marker {
    if (typeof name !== "string" || name.length === 0) {
      throw new Error("TransitionSeries: marker name must be a non-empty string");
    }
    return new Marker(this, name);
  }

  /** @internal marker-source hook. `settled` = start + incoming transition duration. */
  _kmResolveMarker(name: string | undefined): ScenePlacement {
    const records = this._sceneRecords();
    const i = records.findIndex((r) => r.name === name);
    if (name === undefined || i < 0) {
      const names = records.map((r) => r.name).filter((n): n is string => n !== undefined);
      throw new Error(
        `TransitionSeries: no scene named "${name}" (named scenes: ${names.length > 0 ? names.join(", ") : "none"})`,
      );
    }
    const placed = this._placeRecords(records);
    const p = placed[i];
    if (!p) throw new Error(`TransitionSeries: scene "${name}" has no placement`);
    const incoming = records[i]?.incoming?.duration ?? 0;
    return { from: p.from, end: p.from + p.durationInFrames, settled: p.from + incoming };
  }

  /** Flatten items into scene records, each carrying its incoming/outgoing transition. */
  private _sceneRecords(): SceneRecord[] {
    const fps = this.composition.fps;
    const records: SceneRecord[] = [];
    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i];
      if (item?.kind !== "scene") continue;
      const prev = this._items[i - 1];
      const next = this._items[i + 1];
      const record: SceneRecord = {
        name: item.name,
        durationInFrames: item.durationInFrames,
        build: item.build,
      };
      if (prev?.kind === "transition") {
        const duration = prev.timing.getDurationInFrames(fps);
        record.incoming = { presentation: prev.presentation, timing: prev.timing, duration };
      }
      if (next?.kind === "transition") {
        const duration = next.timing.getDurationInFrames(fps);
        record.outgoing = { presentation: next.presentation, timing: next.timing, duration };
      }
      records.push(record);
    }
    return records;
  }

  /** Place records on the timeline: an incoming transition overlaps by its duration. */
  private _placeRecords(records: SceneRecord[]): PlacedScene[] {
    const offsetScenes: OffsetScene[] = records.map((r) => ({
      durationInFrames: r.durationInFrames,
      offset: r.incoming ? -r.incoming.duration : 0,
    }));
    return computeOffsets(offsetScenes, this.from).placed;
  }

  transition(opts: TransitionSeriesTransitionOptions): this {
    const last = this._items[this._items.length - 1];
    if (!last) {
      throw new Error(
        "TransitionSeries: a transition must not be the first item — add a scene first",
      );
    }
    if (last.kind === "transition") {
      throw new Error(
        "TransitionSeries: two transitions must not be adjacent — add a scene between them",
      );
    }
    this._items.push({ kind: "transition", presentation: opts.presentation, timing: opts.timing });
    return this;
  }

  /** Σ scene durations − Σ transition durations. */
  get durationInFrames(): number {
    const fps = this.composition.fps;
    let total = 0;
    for (const item of this._items) {
      if (item.kind === "scene") total += item.durationInFrames;
      else total -= item.timing.getDurationInFrames(fps);
    }
    return total;
  }

  /**
   * Build every scene `Sequence` (with overlaps resolved) plus a GL overlay
   * `Sequence` for each Tier B transition. Add them all to the composition.
   */
  sequences(): Sequence[] {
    if (this._items.length === 0) {
      throw new Error("TransitionSeries: add at least one scene before reading sequences");
    }
    if (this._items[this._items.length - 1]?.kind === "transition") {
      throw new Error(
        "TransitionSeries: a transition must not be the last item — end with a scene",
      );
    }

    const fps = this.composition.fps;
    const dims: PresentationDims = {
      width: this.composition.width(),
      height: this.composition.height(),
    };
    const compositor = getCompositor();

    const records = this._sceneRecords();

    // Validate transition duration ≤ each neighbour scene's duration.
    for (const record of records) {
      if (record.incoming && record.incoming.duration > record.durationInFrames) {
        throw new Error(
          `TransitionSeries: a transition (${record.incoming.duration} frames) must not be longer than the previous scene (${record.durationInFrames} frames)`,
        );
      }
      if (record.outgoing && record.outgoing.duration > record.durationInFrames) {
        throw new Error(
          `TransitionSeries: a transition (${record.outgoing.duration} frames) must not be longer than the next scene (${record.durationInFrames} frames)`,
        );
      }
    }

    // Resolve each scene's `from`: an incoming transition overlaps by its duration.
    const placed = this._placeRecords(records);

    const sceneSeqs: Sequence[] = [];
    const overlaySeqs: Sequence[] = [];

    records.forEach((record, i) => {
      const place = placed[i];
      if (!place) return;
      const seq = new Sequence({ from: place.from, durationInFrames: place.durationInFrames });
      record.build(seq);
      sceneSeqs.push(seq);

      // Resolve presentations, falling back to fade when GL is unavailable.
      const incoming = record.incoming
        ? {
            ...record.incoming,
            presentation: this._resolve(record.incoming.presentation, compositor),
          }
        : undefined;
      const outgoing = record.outgoing
        ? {
            ...record.outgoing,
            presentation: this._resolve(record.outgoing.presentation, compositor),
          }
        : undefined;

      const dur = place.durationInFrames;
      if (incoming || outgoing) {
        seq.register((local) => {
          if (incoming && local < incoming.duration && !incoming.presentation.gl) {
            const p = incoming.timing.getProgress(local, fps);
            incoming.presentation.enter?.(seq, p, dims);
            return;
          }
          if (outgoing && local >= dur - outgoing.duration && !outgoing.presentation.gl) {
            const p = outgoing.timing.getProgress(local - (dur - outgoing.duration), fps);
            outgoing.presentation.exit?.(seq, p, dims);
            return;
          }
          resetLayer(seq);
        });
      }

      // Tier B: an overlay sequence drives the GL compositor over the overlap.
      if (incoming?.presentation.gl && compositor) {
        const outgoingSeq = sceneSeqs[i - 1];
        const gl = incoming.presentation.gl;
        const timing = incoming.timing;
        const d = incoming.duration;
        if (outgoingSeq) {
          const overlay = new Sequence({ from: place.from, durationInFrames: d });
          const image = new Konva.Image({
            x: 0,
            y: 0,
            width: dims.width,
            height: dims.height,
            image: undefined,
            listening: false,
          });
          overlay.add(image);
          overlay.register((local) => {
            const p = timing.getProgress(local, fps);
            const incomingCanvas = seq.toCanvas({
              x: 0,
              y: 0,
              width: dims.width,
              height: dims.height,
              pixelRatio: 1,
            });
            const outgoingCanvas = outgoingSeq.toCanvas({
              x: 0,
              y: 0,
              width: dims.width,
              height: dims.height,
              pixelRatio: 1,
            });
            const out = compositor.render(
              gl.fragment,
              incomingCanvas,
              outgoingCanvas,
              p,
              gl.uniforms?.(p, dims) ?? {},
              dims.width,
              dims.height,
            );
            image.image(out);
          });
          overlaySeqs.push(overlay);
        }
      }
    });

    // Overlays added last so they z-order above the scene layers they blend.
    return [...sceneSeqs, ...overlaySeqs];
  }

  /** Swap a GL presentation for `fade()` when no WebGL context is available. */
  private _resolve(presentation: Presentation, compositor: unknown): Presentation {
    if (presentation.gl && !compositor) {
      if (!warnedNoWebGl) {
        warnedNoWebGl = true;
        console.warn(
          "@smoove/transitions: WebGL2 unavailable — shader transitions fall back to fade().",
        );
      }
      return fade();
    }
    return presentation;
  }
}
