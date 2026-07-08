import Konva from "konva";
import { applyLayerEffects, initNodeEffects } from "../effects/apply.js";
import type { SmooveEffect } from "../effects/contract.js";
import { isKMLayoutRoot } from "../layout/contract.js";
import { MEDIA_MARK, TICK_MARK } from "../media/media-marker.js";
import { getComposition } from "./composition.js";
import { getEnvironment } from "./environment.js";

export type SequenceOptions = Konva.LayerConfig & {
  /** Composition frame this sequence starts on. Defaults to `0`. */
  from?: number;
  /**
   * How many frames the sequence spans. When omitted it defaults to the host
   * composition's `durationInFrames` — i.e. a layer spanning the whole comp.
   * Resolved live once added (see {@link Sequence.durationInFrames}).
   */
  durationInFrames?: number;
  /** Layer-wide effects applied after children draw (e.g. grain over a scene). */
  effects?: SmooveEffect[];
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

export class Sequence extends Konva.Layer {
  readonly from: number;
  /** Explicit span, or `undefined` to default to the host comp's duration. */
  private readonly _durationInFrames?: number;
  private readonly _updaters = new Set<Updater>();
  private _active = false;
  private _media: MediaNode[] = [];
  // Last local frame applied while active — used to skip redundant re-applies
  // (updaters + layout + draw) when nothing about the playhead changed. `-1` is
  // a sentinel that never equals a real local frame, so the first apply always runs.
  private _lastLocal = -1;

  constructor(opts: SequenceOptions = {}) {
    const { from = 0, durationInFrames, ...layerOpts } = opts;
    if (!Number.isInteger(from) || from < 0) {
      throw new Error("Sequence: from must be a non-negative integer");
    }
    // durationInFrames is optional: when omitted it resolves to the host comp's
    // duration (see the getter). Only validate an explicitly provided value.
    if (
      durationInFrames !== undefined &&
      (!Number.isInteger(durationInFrames) || durationInFrames <= 0)
    ) {
      throw new Error("Sequence: durationInFrames must be a positive integer");
    }
    super({ ...layerOpts, visible: false });
    this.from = from;
    this._durationInFrames = durationInFrames;
    initNodeEffects(this);
  }

  effects(): SmooveEffect[];
  effects(list: SmooveEffect[]): this;
  effects(list?: SmooveEffect[]): SmooveEffect[] | this {
    if (list === undefined) return (this.getAttr("effects") as SmooveEffect[] | undefined) ?? [];
    this.setAttr("effects", list);
    return this;
  }

  override drawScene(...args: Parameters<Konva.Layer["drawScene"]>): this {
    // Server renders: truncate the layer canvas's skia display list before the
    // redraw. skia-canvas replays the full recorded history on every pixel
    // read (`getImageData`/`toBufferSync`), so without this a long render
    // degrades quadratically. reset() wipes the pixelRatio scale Konva bakes
    // into the context at setSize — reapply it.
    const stage = this.getStage();
    if (!args[0] && stage && getEnvironment(stage).isRendering) {
      const canvas = this.getCanvas();
      const raw = canvas.getContext()._context as CanvasRenderingContext2D & { reset?(): void };
      if (raw.reset) {
        raw.reset();
        raw.scale(canvas.pixelRatio, canvas.pixelRatio);
      }
    }
    super.drawScene(...args);
    // biome-ignore lint/suspicious/noExplicitAny: structural canvas view for the post-pass helper.
    applyLayerEffects(this, args[0] as any);
    return this;
  }

  /**
   * Frames this sequence spans. When constructed without an explicit
   * `durationInFrames`, this resolves **live** to the host composition's
   * `durationInFrames` — a layer that spans the whole comp. Before the sequence
   * is added to a composition (no reachable stage) it reports `Infinity`,
   * meaning "unbounded"; `_apply` is only ever driven by the comp, so by then
   * the real duration is reachable.
   */
  get durationInFrames(): number {
    if (this._durationInFrames !== undefined) return this._durationInFrames;
    const stage = this.getStage();
    const comp = stage && getComposition(stage);
    return comp ? comp.durationInFrames.get() : Number.POSITIVE_INFINITY;
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
      // Offline rendering: don't draw at all — `captureCanvas()` forces a
      // synchronous `drawScene()` on every visible layer at capture time, so a
      // draw here would run every effect chain twice per frame (and the
      // rAF-fallback `batchDraw` would fire a third, torn draw between frames).
      const stage = this.getStage();
      if (stage && getEnvironment(stage).isRendering) return;
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
