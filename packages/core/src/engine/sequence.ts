import Konva from "konva";
import { isKMLayoutRoot } from "../layout/contract.js";
import { MEDIA_MARK, TICK_MARK } from "../media/media-marker.js";

export type SequenceOptions = Konva.LayerConfig & {
  from: number;
  durationInFrames: number;
};

export type Updater = (localFrame: number) => void;

/**
 * Anything that expands into a list of `Sequence`s — e.g. `Series` or
 * `@konva-motion/transitions`' `TransitionSeries`. `Composition.add` accepts a
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
  readonly durationInFrames: number;
  private readonly _updaters = new Set<Updater>();
  private _active = false;
  private _media: MediaNode[] = [];

  constructor(opts: SequenceOptions) {
    if (!Number.isInteger(opts.from) || opts.from < 0) {
      throw new Error("Sequence: from must be a non-negative integer");
    }
    if (!Number.isInteger(opts.durationInFrames) || opts.durationInFrames <= 0) {
      throw new Error("Sequence: durationInFrames must be a positive integer");
    }
    const { from, durationInFrames, ...layerOpts } = opts;
    super({ ...layerOpts, visible: false });
    this.from = from;
    this.durationInFrames = durationInFrames;
  }

  register(updater: Updater): () => void {
    this._updaters.add(updater);
    return () => {
      this._updaters.delete(updater);
    };
  }

  /** Internal — called by Composition on each frame change. */
  _apply(frame: number): void {
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
      for (const v of this._media) v._kmDeactivate?.();
    }
  }
}
