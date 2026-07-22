import type Konva from "konva";
import { isKMLayoutRoot } from "../layout/contract.js";
import { MEDIA_MARK, TICK_MARK, TIMELINE_MARK } from "../markers.js";
import { getComposition } from "./composition.js";
import { type FrameAnchor, Marker, type MarkerSource, type ScenePlacement } from "./marker.js";
import { structureVersion } from "./structure.js";

/**
 * The shared **timeline core** behind `Sequence` (a stage-level `Konva.Layer`)
 * and `Clip` (a nestable `Konva.Group`): range options, the updater set,
 * activation/deactivation, tickable discovery, and the per-frame pass. The
 * mixin follows the `FlexShape` precedent — one implementation, two Konva
 * bases.
 *
 * **Import-order note:** this module sits in an import cycle
 * (timeline → composition → sequence → timeline). That is safe as long as
 * this module is never the *first* of the cluster to evaluate — `Sequence`
 * and `Clip` call {@link TimelineMixin} at module-eval time, while this
 * module only touches `composition.js` at runtime. Import `Clip`/`Sequence`/
 * `Composition` (or the package index) first; never deep-import this file as
 * an entry point.
 *
 * @module
 */

/** Range options shared by `Sequence` and `Clip`. */
export type TimelineOptions = {
  /**
   * Frame this timeline starts on — absolute for a `Sequence`, parent-local
   * for a `Clip`. Accepts a `Marker`/`MarkerPoint` (always absolute), resolved
   * live. Defaults to `0`.
   */
  from?: FrameAnchor;
  /**
   * How many frames the timeline spans. When omitted it defaults to the rest
   * of the host (a `Sequence` spans its composition, a `Clip` the remainder of
   * its parent timeline). Mutually exclusive with {@link until}.
   */
  durationInFrames?: number;
  /**
   * End anchor: the span becomes `resolve(until) − resolve(from)`, kept live.
   * Mutually exclusive with {@link durationInFrames}.
   */
  until?: FrameAnchor;
  /**
   * Span exactly this marker's range — sugar for
   * `{ from: marker.start, until: marker.end }`. Mutually exclusive with
   * `from`, `durationInFrames`, and `until`.
   */
  span?: Marker;
};

/** Extra per-frame context handed to every updater alongside the local frame. */
export type FrameInfo = {
  /** Timeline-local seconds: `localFrame / fps`. */
  time: number;
  /** The host composition's fps (`0` when detached). */
  fps: number;
  /** This timeline's own span in frames. */
  durationInFrames: number;
  /** The absolute composition frame. */
  globalFrame: number;
};

export type Updater = (localFrame: number, info: FrameInfo) => void;

/**
 * The internal tick contract (media nodes, `Text` tickers, nested `Clip`s):
 * `_kmTick` runs the node's frame, `_kmDeactivate` resets it when its timeline
 * leaves range. `tickMedia: false` is the `measure()` pass — a `Clip` forwards
 * it so media below is never seeked at a foreign frame.
 */
export type TickableNode = Konva.Node & {
  _kmTick?: (localFrame: number, tickMedia?: boolean) => void;
  _kmDeactivate?: () => void;
};

/** Validated timeline options with `span` desugared into `from`/`until`. */
export type ParsedTimelineOptions = {
  from: FrameAnchor;
  durationInFrames?: number;
  until?: FrameAnchor;
};

/**
 * Validate and desugar {@link TimelineOptions}. `label` prefixes error
 * messages (`"Sequence"` / `"Clip"`). Takes the raw options object so the
 * `span`-vs-`from` exclusivity check can distinguish an explicit `from` from
 * the default.
 */
export function parseTimelineOptions(label: string, opts: TimelineOptions): ParsedTimelineOptions {
  const { from = 0, durationInFrames, until, span } = opts;
  if (
    span !== undefined &&
    ("from" in opts || durationInFrames !== undefined || until !== undefined)
  ) {
    throw new Error(`${label}: span is mutually exclusive with from/durationInFrames/until`);
  }
  if (typeof from === "number" && (!Number.isInteger(from) || from < 0)) {
    throw new Error(`${label}: from must be a non-negative integer`);
  }
  if (durationInFrames !== undefined && until !== undefined) {
    throw new Error(`${label}: durationInFrames and until are mutually exclusive — provide one`);
  }
  if (
    durationInFrames !== undefined &&
    (!Number.isInteger(durationInFrames) || durationInFrames <= 0)
  ) {
    throw new Error(`${label}: durationInFrames must be a positive integer`);
  }
  if (typeof until === "number" && (!Number.isInteger(until) || until <= 0)) {
    throw new Error(`${label}: until must be a positive integer frame`);
  }
  return span !== undefined
    ? { from: span.start, until: span.end }
    : { from, durationInFrames, until };
}

/** The cross-class face of a timeline, used by nearest-ancestor walks. */
export type KMTimeline = Konva.Container & {
  from: number;
  durationInFrames: number;
  _kmAbsoluteStart(): number;
  _kmRunFrame(local: number, tickMedia: boolean): void;
};

/**
 * The nearest timeline **strictly above** `node` (`Sequence` or `Clip`), or
 * `null`. Marker-based so this file needs no imports of either class.
 */
export function nearestTimeline(node: Konva.Node): KMTimeline | null {
  let p: Konva.Node | null = node.getParent();
  while (p) {
    if (p.getAttr(TIMELINE_MARK) === true) return p as unknown as KMTimeline;
    p = p.getParent();
  }
  return null;
}

/** A cached query result: valid while the structure version stands still. */
type QueryEntry = { v: number; res: Konva.Node[] };

export type QuerySelector = string | ((n: Konva.Node) => boolean);

/**
 * Anything `find()`-able — structural, because `Composition` narrows `add`
 * and no longer satisfies `Konva.Container` nominally.
 */
type Queryable = { find(selector: QuerySelector): Konva.Node[] };

/**
 * Run a (possibly cached) query on `host`. String selectors (Konva syntax:
 * `#id`, `.name`, `TypeName`) are cached in `cache` against the structure
 * version; predicate functions bypass the cache (function identity is not a
 * usable key). Name/id attrs are assumed set at construction — renaming a
 * mounted node does not invalidate.
 */
export function runQuery(
  host: Queryable,
  cache: Map<string, QueryEntry>,
  selector: QuerySelector,
): Konva.Node[] {
  if (typeof selector !== "string") return host.find(selector);
  const v = structureVersion();
  const hit = cache.get(selector);
  if (hit && hit.v === v) return hit.res;
  const res = host.find(selector) as Konva.Node[];
  cache.set(selector, { v, res });
  return res;
}

// biome-ignore lint/suspicious/noExplicitAny: mixin base accepts any Konva container constructor.
type TimelineBase = abstract new (...args: any[]) => Konva.Container;

/**
 * The typed face of the timeline mixin — declaration-emit-friendly (an
 * anonymous mixin class can't be emitted; `FlexShape` uses the same pattern).
 * Underscore members are internal, like everywhere else in the engine.
 */
export type TimelineFace = MarkerSource & {
  _kmLabel: string;
  _kmActive: boolean;
  _kmLastLocal: number;
  _kmInitTimeline(label: string, parsed: ParsedTimelineOptions): void;
  _kmResolveAnchor(anchor: FrameAnchor): number;
  _kmDefaultDuration(): number;
  _kmAbsoluteStart(): number;
  readonly from: number;
  readonly durationInFrames: number;
  marker(): Marker;
  register(updater: Updater): () => void;
  query<T extends Konva.Node = Konva.Node>(selector: QuerySelector): T[];
  queryOne<T extends Konva.Node = Konva.Node>(selector: QuerySelector): T | null;
  _kmTickables(): TickableNode[];
  _kmRunFrame(local: number, tickMedia: boolean): void;
  _kmDeactivateSubtree(): void;
  _kmFrameInfo(local: number): FrameInfo;
};

/**
 * Build the timeline core over a Konva container base. The subclass
 * constructor calls `_kmInitTimeline` with its parsed options, and implements
 * the three coordinate hooks (`_kmResolveAnchor`, `_kmDefaultDuration`,
 * `_kmAbsoluteStart`) plus its own activation driver (`Sequence._apply` /
 * `Clip._kmTick`).
 */
export function TimelineMixin<TBase extends TimelineBase>(
  Base: TBase,
  // biome-ignore lint/suspicious/noExplicitAny: mixin ctor intersections require matching any[] args.
): TBase & (abstract new (...args: any[]) => TimelineFace) {
  abstract class Timeline extends Base implements MarkerSource {
    /** @internal error-message prefix + timeline identity. */
    _kmLabel = "Timeline";
    _kmFrom: FrameAnchor = 0;
    _kmDuration?: number;
    _kmUntil?: FrameAnchor;
    _kmActive = false;
    // Last local frame applied while active — `-1` is a sentinel that never
    // equals a real local frame. `Sequence` uses it to dedupe redundant
    // re-applies; both classes reset it on deactivation.
    _kmLastLocal = -1;
    readonly _kmUpdaters = new Set<Updater>();
    // Tickable + query caches, keyed on the global structure version — any
    // add/remove/destroy anywhere invalidates them (see structure.ts). `0`
    // never matches a real version, so the first read always builds.
    private _kmTickCache: TickableNode[] = [];
    private _kmTickCacheVersion = 0;
    private readonly _kmQueryCache = new Map<string, QueryEntry>();

    /** @internal called once from the subclass constructor. */
    _kmInitTimeline(label: string, parsed: ParsedTimelineOptions): void {
      this._kmLabel = label;
      this._kmFrom = parsed.from;
      this._kmDuration = parsed.durationInFrames;
      this._kmUntil = parsed.until;
      this.setAttr(TIMELINE_MARK, true);
    }

    /** Resolve an anchor into this timeline's own coordinate space. */
    abstract _kmResolveAnchor(anchor: FrameAnchor): number;
    /** The span used when neither `durationInFrames` nor `until` was given. */
    abstract _kmDefaultDuration(): number;
    /** This timeline's start as an absolute composition frame. */
    abstract _kmAbsoluteStart(): number;

    /**
     * Frame this timeline starts on — absolute for a `Sequence`, parent-local
     * for a `Clip`. Marker-valued anchors resolve on every read (live), so
     * retiming the marked scene moves this timeline automatically.
     */
    get from(): number {
      return this._kmResolveAnchor(this._kmFrom);
    }

    /**
     * Frames this timeline spans. With `until`, resolves live as
     * `resolve(until) − resolve(from)`. Without an explicit span it resolves
     * **live** to the rest of the host (composition / parent timeline);
     * detached from any host it reports `Infinity`, meaning "unbounded".
     */
    get durationInFrames(): number {
      if (this._kmUntil !== undefined) {
        const from = this.from;
        const until = this._kmResolveAnchor(this._kmUntil);
        const d = until - from;
        if (d <= 0) {
          throw new Error(`${this._kmLabel}: until (${until}) must be after from (${from})`);
        }
        return d;
      }
      if (this._kmDuration !== undefined) return this._kmDuration;
      return this._kmDefaultDuration();
    }

    /**
     * A {@link Marker} onto this timeline's own placement. Anchor other
     * sequences/clips to it: `new Sequence({ from: intro.marker().end })`.
     */
    marker(): Marker {
      return new Marker(this);
    }

    /** @internal marker-source hook. A plain timeline has no incoming overlap. */
    _kmResolveMarker(): ScenePlacement {
      const from = this._kmAbsoluteStart();
      return { from, end: from + this.durationInFrames, settled: from };
    }

    register(updater: Updater): () => void {
      this._kmUpdaters.add(updater);
      return () => {
        this._kmUpdaters.delete(updater);
      };
    }

    /**
     * Query this timeline's subtree with a Konva selector (`#id`, `.name`,
     * `TypeName`), cached against the structure version — cheap to call every
     * frame from an updater. Predicate selectors bypass the cache.
     */
    query<T extends Konva.Node = Konva.Node>(selector: QuerySelector): T[] {
      return runQuery(this, this._kmQueryCache, selector) as T[];
    }

    /** First {@link query} match, or `null`. */
    queryOne<T extends Konva.Node = Konva.Node>(selector: QuerySelector): T | null {
      return (this.query<T>(selector)[0] as T | undefined) ?? null;
    }

    /**
     * The tickable descendants this timeline drives: media (`MEDIA_MARK`) and
     * tick nodes (`TICK_MARK`, e.g. a `Text` typewriter or a nested `Clip`)
     * whose **nearest timeline ancestor is this one** — nodes inside a nested
     * clip belong to that clip's pass, never to this one. Rebuilt only when
     * the structure version moved since the last walk.
     */
    _kmTickables(): TickableNode[] {
      const v = structureVersion();
      if (this._kmTickCacheVersion !== v) {
        this._kmTickCache = this.find(
          (n: Konva.Node) => n.getAttr(MEDIA_MARK) === true || n.getAttr(TICK_MARK) === true,
        ).filter((n: Konva.Node) => nearestTimeline(n) === (this as unknown as KMTimeline));
        this._kmTickCacheVersion = v;
      }
      return this._kmTickCache;
    }

    /**
     * @internal the frame pass shared by activation drivers and `measure()`:
     * updaters, ticks, then flex layout of every direct-child layout root. No
     * visibility change, no draw — callers own that. With `tickMedia: false`
     * (the measure path) media-only nodes are skipped and nested clips
     * forward the flag: media state never affects layout, and ticking a video
     * at a foreign frame would trigger spurious seeks.
     */
    _kmRunFrame(local: number, tickMedia: boolean): void {
      const tickables = this._kmTickables();
      if (this._kmUpdaters.size > 0) {
        const info = this._kmFrameInfo(local);
        for (const u of this._kmUpdaters) u(local, info);
      }
      // Tick BEFORE layout: a ticked node may change its measured size (e.g. a
      // Text typewriter revealing another line), and the flex pass must see the
      // up-to-date size this frame rather than lagging one behind.
      for (const v of tickables) {
        if (!tickMedia && v.getAttr(MEDIA_MARK) === true && v.getAttr(TICK_MARK) !== true) {
          continue;
        }

        v._kmTick?.(local, tickMedia);
      }
      
      for (const c of this.getChildren()) {
        if (isKMLayoutRoot(c)) c._kmComputeLayout();
      }
    }

    /** @internal deactivate every tickable this timeline drives (recurses via clips). */
    _kmDeactivateSubtree(): void {
      for (const v of this._kmTickCache) v._kmDeactivate?.();
    }

    /** @internal the {@link FrameInfo} for `local`, built once per frame pass. */
    _kmFrameInfo(local: number): FrameInfo {
      const stage = this.getStage();
      const comp = stage ? getComposition(stage) : null;
      const fps = comp?.fps ?? 0;
      return {
        time: fps > 0 ? local / fps : 0,
        fps,
        durationInFrames: this.durationInFrames,
        globalFrame: this._kmAbsoluteStart() + local,
      };
    }
  }
  // biome-ignore lint/suspicious/noExplicitAny: see the return-type note above.
  return Timeline as unknown as TBase & (abstract new (...args: any[]) => TimelineFace);
}
