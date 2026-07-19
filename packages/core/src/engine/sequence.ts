import Konva from "konva";
import { isKMLayoutRoot } from "../layout/contract.js";
import { MEDIA_MARK, TICK_MARK } from "../markers.js";
import { getComposition } from "./composition.js";
import {
  type FrameAnchor,
  Marker,
  type MarkerSource,
  resolveFrameAnchor,
  type ScenePlacement,
} from "./marker.js";

export type SequenceOptions = Konva.LayerConfig & {
  /**
   * Composition frame this sequence starts on: an absolute frame, or a
   * `Marker`/`MarkerPoint` resolved live (retiming the marked scene moves
   * this sequence with it). Defaults to `0`.
   */
  from?: FrameAnchor;
  /**
   * How many frames the sequence spans. When omitted it defaults to the host
   * composition's `durationInFrames` — i.e. a layer spanning the whole comp.
   * Resolved live once added (see {@link Sequence.durationInFrames}).
   * Mutually exclusive with {@link until}.
   */
  durationInFrames?: number;
  /**
   * End anchor: the span becomes `resolve(until) − resolve(from)`, kept live
   * so retiming either end moves the window. Mutually exclusive with
   * {@link durationInFrames}.
   */
  until?: FrameAnchor;
};

export type Updater = (localFrame: number) => void;

/**
 * Anything that expands into a list of `Sequence`s — e.g. `Series` or
 * `@smoove/transitions`' `TransitionSeries`. `Composition.add` accepts a
 * provider directly and adds each sequence it yields, so callers can write
 * `comp.add(series)` instead of looping over `series.sequences()`.
 */
export type SequenceProvider = { sequences(): Sequence[] };

/** Media nodes (video/audio) are discovered by marker attr to keep this file independent of `video/`+`audio/`. */
type MediaNode = Konva.Node & {
  _kmTick?: (localFrame: number) => void;
  _kmDeactivate?: () => void;
};

export class Sequence extends Konva.Layer implements MarkerSource {
  private readonly _from: FrameAnchor;
  /** Explicit span, or `undefined` to default to `until`/the host comp's duration. */
  private readonly _durationInFrames?: number;
  private readonly _until?: FrameAnchor;
  private readonly _updaters = new Set<Updater>();
  private _active = false;
  private _media: MediaNode[] = [];
  // Last local frame applied while active — used to skip redundant re-applies
  // (updaters + layout + draw) when nothing about the playhead changed. `-1` is
  // a sentinel that never equals a real local frame, so the first apply always runs.
  private _lastLocal = -1;

  constructor(opts: SequenceOptions = {}) {
    const { from = 0, durationInFrames, until, ...layerOpts } = opts;
    if (typeof from === "number" && (!Number.isInteger(from) || from < 0)) {
      throw new Error("Sequence: from must be a non-negative integer");
    }
    if (durationInFrames !== undefined && until !== undefined) {
      throw new Error("Sequence: durationInFrames and until are mutually exclusive — provide one");
    }
    // durationInFrames is optional: when omitted it resolves to the host comp's
    // duration (see the getter). Only validate an explicitly provided value.
    if (
      durationInFrames !== undefined &&
      (!Number.isInteger(durationInFrames) || durationInFrames <= 0)
    ) {
      throw new Error("Sequence: durationInFrames must be a positive integer");
    }
    if (typeof until === "number" && (!Number.isInteger(until) || until <= 0)) {
      throw new Error("Sequence: until must be a positive integer frame");
    }
    super({ ...layerOpts, visible: false });
    this._from = from;
    this._durationInFrames = durationInFrames;
    this._until = until;
  }

  /**
   * Composition frame this sequence starts on. Marker-valued `from` resolves
   * on every read (live, like {@link durationInFrames}), so retiming the
   * marked scene moves this sequence automatically.
   */
  get from(): number {
    return resolveFrameAnchor(this._from);
  }

  /**
   * Frames this sequence spans. With `until`, resolves live as
   * `resolve(until) − resolve(from)`. When constructed without an explicit
   * span, this resolves **live** to the host composition's
   * `durationInFrames` — a layer that spans the whole comp. Before the
   * sequence is added to a composition (no reachable stage) it reports
   * `Infinity`, meaning "unbounded"; `_apply` is only ever driven by the
   * comp, so by then the real duration is reachable.
   */
  get durationInFrames(): number {
    if (this._until !== undefined) {
      const from = this.from;
      const until = resolveFrameAnchor(this._until);
      const d = until - from;
      if (d <= 0) {
        throw new Error(`Sequence: until (${until}) must be after from (${from})`);
      }
      return d;
    }
    if (this._durationInFrames !== undefined) return this._durationInFrames;
    const stage = this.getStage();
    const comp = stage && getComposition(stage);
    return comp ? comp.durationInFrames.get() : Number.POSITIVE_INFINITY;
  }

  /**
   * A {@link Marker} onto this sequence's own placement — no name, a
   * sequence *is* a single scene. Anchor other sequences to it:
   * `new Sequence({ from: intro.marker().end })`.
   */
  marker(): Marker {
    return new Marker(this);
  }

  /** @internal marker-source hook. A plain sequence has no incoming overlap. */
  _kmResolveMarker(): ScenePlacement {
    const from = this.from;
    return { from, end: from + this.durationInFrames, settled: from };
  }

  register(updater: Updater): () => void {
    this._updaters.add(updater);
    return () => {
      this._updaters.delete(updater);
    };
  }

  /**
   * Internal — called by Composition on each frame change.
   *
   * `force` re-runs the frame even when the local playhead hasn't moved — needed
   * when external state updaters read (props) changed at the same frame
   * (`refresh()`), on the initial paint, and for offline rendering. During normal
   * playback the local frame advances every tick, so the dedupe never trips; it
   * only skips genuinely redundant re-applies (e.g. a `refresh()` that changed
   * nothing, or a same-frame re-entry), avoiding a wasted updater + layout + draw.
   */
  _apply(frame: number, force = false): void {
    const inRange = frame >= this.from && frame < this.from + this.durationInFrames;
    if (inRange) {
      const becameActive = !this._active;
      if (becameActive) {
        this.visible(true);
        this._active = true;
        // Cache tickable nodes once per activation — avoids a subtree walk every
        // frame. Includes media (video/audio) plus non-media tickers (Text typewriter).
        this._media = this.find(
          (n: Konva.Node) => n.getAttr(MEDIA_MARK) === true || n.getAttr(TICK_MARK) === true,
        ) as MediaNode[];
      }
      const local = frame - this.from;
      // Skip redundant work: same playhead, already active, and not forced.
      if (!becameActive && !force && local === this._lastLocal) return;
      this._lastLocal = local;
      for (const u of this._updaters) u(local);
      // Tick BEFORE layout: a ticked node may change its measured size (e.g. a
      // Text typewriter revealing another line), and the flex pass must see the
      // up-to-date size this frame rather than lagging one behind.
      for (const v of this._media) v._kmTick?.(local);
      for (const c of this.getChildren()) {
        if (isKMLayoutRoot(c)) c._kmComputeLayout();
      }
      // Draw synchronously the frame in which a sequence becomes visible — this
      // ensures fresh pixels are on the canvas before the browser paints the
      // newly-displayed layer (avoids a one-frame flash of stale content).
      if (becameActive) this.draw();
      else this.batchDraw();
    } else if (this._active) {
      this.visible(false);
      this._active = false;
      this._lastLocal = -1;
      for (const v of this._media) v._kmDeactivate?.();
    }
  }

  /**
   * Internal — force this sequence hidden and inactive, regardless of frame
   * range. Used by `Composition` while it buffers assets so the stage stays
   * transparent (no frame painted over not-yet-loaded fonts). The next
   * {@link _apply} re-activates it normally.
   */
  _kmHide(): void {
    if (!this._active && !this.visible()) return;
    this.visible(false);
    this._active = false;
    this._lastLocal = -1;
    for (const v of this._media) v._kmDeactivate?.();
  }
}
