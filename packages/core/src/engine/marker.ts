/**
 * Timeline markers: lazily-resolving, immutable handles onto a scene's
 * placement inside a marker source (`Series`, `TransitionSeries`, or a
 * standalone `Sequence`). A marker stores no frame number — every read
 * resolves against the source's *current* placement, so retiming a scene
 * moves everything anchored to it.
 *
 * @module
 */

/** Resolved placement of one scene: window open/close plus the settled point. */
export type ScenePlacement = {
  /** Frame the scene's sequence window opens. */
  from: number;
  /** Frame the window closes (`from + durationInFrames`). */
  end: number;
  /**
   * `from` + incoming overlap — the frame the scene is fully revealed. For
   * `TransitionSeries` the overlap is the incoming transition's duration; for
   * `Series` it is `max(0, −offset)`; for a standalone `Sequence` it is `0`
   * (so `settled === from`).
   */
  settled: number;
};

/**
 * Implemented by anything that hands out markers. `name` is `undefined` for
 * single-scene sources (a standalone `Sequence`).
 *
 * @internal
 */
export type MarkerSource = {
  _kmResolveMarker(name: string | undefined): ScenePlacement;
};

// Re-entrancy guard: resolving a marker may resolve the source's `from`,
// which may itself be a marker. A genuine loop revisits the same
// (source, name) pair — throw instead of recursing forever.
const resolutionStack: Array<{ source: MarkerSource; name: string | undefined }> = [];

function resolvePlacement(source: MarkerSource, name: string | undefined): ScenePlacement {
  for (const entry of resolutionStack) {
    if (entry.source === source && entry.name === name) {
      throw new Error(
        `marker: circular anchoring while resolving "${name ?? "(sequence)"}" — its timeline position depends on itself`,
      );
    }
  }
  resolutionStack.push({ source, name });
  try {
    return source._kmResolveMarker(name);
  } finally {
    resolutionStack.pop();
  }
}

export type MarkerKind = "start" | "end" | "settled";

/**
 * One anchorable point of a marked scene (`start`, `end`, or `settled`),
 * optionally shifted by an integer frame delta. Immutable: `add()` returns a
 * new point. Accepted anywhere a {@link FrameAnchor} is.
 */
export class MarkerPoint {
  /** @internal — obtain points via `Marker#start`/`end`/`settled`. */
  constructor(
    private readonly _source: MarkerSource,
    private readonly _name: string | undefined,
    readonly kind: MarkerKind,
    readonly delta: number,
  ) {}

  /** A new point shifted by `n` frames (integer; deltas accumulate). */
  add(n: number): MarkerPoint {
    if (!Number.isInteger(n)) {
      throw new Error(`marker: add() delta must be an integer (got ${n})`);
    }
    return new MarkerPoint(this._source, this._name, this.kind, this.delta + n);
  }

  /**
   * Resolve to a frame number **now**. Prefer passing the point itself to
   * `from:`/`until:` — an eagerly resolved number freezes and desyncs when
   * the timeline is retimed.
   */
  resolve(): number {
    const placement = resolvePlacement(this._source, this._name);
    const base =
      this.kind === "start"
        ? placement.from
        : this.kind === "end"
          ? placement.end
          : placement.settled;
    if (!Number.isFinite(base)) {
      throw new Error(
        `marker: cannot resolve "${this.kind}"${this._name ? ` of "${this._name}"` : ""} — the source sequence has no explicit duration and isn't attached to a composition`,
      );
    }
    const frame = base + this.delta;
    if (frame < 0) {
      throw new Error(
        `marker: "${this._name ?? "(sequence)"}" ${this.kind}${this.delta ? ` ${this.delta > 0 ? "+" : ""}${this.delta}` : ""} resolves to ${frame}, before frame 0`,
      );
    }
    return frame;
  }
}

/**
 * Handle onto a marked scene. Exposes the three anchorable points; using the
 * bare `Marker` as a {@link FrameAnchor} means its `.start`.
 */
export class Marker {
  /** @internal — obtain via `series.marker(name)` / `sequence.marker()`. */
  constructor(
    private readonly _source: MarkerSource,
    private readonly _name?: string,
  ) {}

  /** The scene's window-open frame (under a transition: the transition begins). */
  get start(): MarkerPoint {
    return new MarkerPoint(this._source, this._name, "start", 0);
  }

  /** The scene's window-close frame. */
  get end(): MarkerPoint {
    return new MarkerPoint(this._source, this._name, "end", 0);
  }

  /** The frame the scene is fully revealed (start + incoming overlap). */
  get settled(): MarkerPoint {
    return new MarkerPoint(this._source, this._name, "settled", 0);
  }

  /** Sugar for `this.start.resolve()`. */
  resolve(): number {
    return this.start.resolve();
  }
}

/** A timeline position: an absolute frame, a `Marker` (its `.start`), or a `MarkerPoint`. */
export type FrameAnchor = number | Marker | MarkerPoint;

/** Resolve a {@link FrameAnchor} to a frame number. @internal */
export function resolveFrameAnchor(anchor: FrameAnchor): number {
  return typeof anchor === "number" ? anchor : anchor.resolve();
}
