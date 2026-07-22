import Konva from "konva";
import { findClip, findComposition, findSequence } from "./ancestry.js";
import { getComposition } from "./composition.js";
import { type FrameAnchor, resolveFrameAnchor } from "./marker.js";
import { parseTimelineOptions, TimelineMixin, type TimelineOptions } from "./timeline.js";

export type SequenceOptions = Konva.LayerConfig & TimelineOptions;

export type { FrameInfo, Updater } from "./timeline.js";

/**
 * Anything that expands into a list of `Sequence`s — e.g. `Series` or
 * `@smoove/transitions`' `TransitionSeries`. `Composition.add` accepts a
 * provider directly and adds each sequence it yields, so callers can write
 * `comp.add(series)` instead of looping over `series.sequences()`.
 */
export type SequenceProvider = { sequences(): Sequence[] };

/**
 * A range-gated `Konva.Layer`: visible and ticked only while the playhead is
 * in `[from, from + durationInFrames)`. The timeline behavior (options,
 * `register`, `marker`, tickable discovery, the frame pass) lives in the
 * shared {@link TimelineMixin}; this class owns the Layer duties — canvas
 * visibility, draw scheduling, and being driven by `Composition._apply`.
 */
export class Sequence extends TimelineMixin(Konva.Layer) {
  constructor(opts: SequenceOptions = {}) {
    const { from, durationInFrames, until, span, ...layerOpts } = opts;
    void from;
    void durationInFrames;
    void until;
    void span;
    const parsed = parseTimelineOptions("Sequence", opts);
    super({ ...layerOpts, visible: false });
    this._kmInitTimeline("Sequence", parsed);
  }

  /** A `Sequence` lives in composition frames — anchors resolve absolutely. */
  override _kmResolveAnchor(anchor: FrameAnchor): number {
    return resolveFrameAnchor(anchor);
  }

  /** Default span: the host composition's duration (live), else `Infinity`. */
  override _kmDefaultDuration(): number {
    const stage = this.getStage();
    const comp = stage && getComposition(stage);
    return comp ? comp.durationInFrames.get() : Number.POSITIVE_INFINITY;
  }

  override _kmAbsoluteStart(): number {
    return this.from;
  }

  /** The owning composition, or `null` while detached — like `getStage()`. */
  getComposition(): ReturnType<typeof findComposition> {
    return findComposition(this);
  }

  /** Self-inclusive, like Konva's `getLayer()` on a layer: returns this sequence. */
  getSequence(): ReturnType<typeof findSequence> {
    return findSequence(this);
  }

  /** The nearest ancestor-or-self `Clip` — always `null` for a sequence. */
  getClip(): ReturnType<typeof findClip> {
    return findClip(this);
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
      const becameActive = !this._kmActive;
      if (becameActive) {
        this.visible(true);
        this._kmActive = true;
      }
      const local = frame - this.from;
      // Skip redundant work: same playhead, already active, and not forced.
      if (!becameActive && !force && local === this._kmLastLocal) return;
      this._kmLastLocal = local;
      this._kmRunFrame(local, true);
      // Draw synchronously the frame in which a sequence becomes visible — this
      // ensures fresh pixels are on the canvas before the browser paints the
      // newly-displayed layer (avoids a one-frame flash of stale content).
      if (becameActive) this.draw();
      else this.batchDraw();
    } else if (this._kmActive) {
      this.visible(false);
      this._kmActive = false;
      this._kmLastLocal = -1;
      this._kmDeactivateSubtree();
    }
  }

  /**
   * Internal — the live local frame while active, else `null`. `measure()`
   * uses this to restore an active sequence after a foreign-frame pass.
   */
  _kmLiveLocal(): number | null {
    return this._kmActive ? this._kmLastLocal : null;
  }

  /**
   * Internal — force this sequence hidden and inactive, regardless of frame
   * range. Used by `Composition` while it buffers assets so the stage stays
   * transparent (no frame painted over not-yet-loaded fonts). The next
   * {@link _apply} re-activates it normally.
   */
  _kmHide(): void {
    if (!this._kmActive && !this.visible()) return;
    this.visible(false);
    this._kmActive = false;
    this._kmLastLocal = -1;
    this._kmDeactivateSubtree();
  }
}
