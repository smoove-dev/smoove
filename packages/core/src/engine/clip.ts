import type Konva from "konva";
import { Group, type GroupConfig } from "../layout/group.js";
import { CLIP_MARK, TICK_MARK } from "../markers.js";
import type { FrameAnchor } from "./marker.js";
import {
  nearestTimeline,
  parseTimelineOptions,
  TimelineMixin,
  type TimelineOptions,
} from "./timeline.js";

export type ClipOptions = GroupConfig & TimelineOptions;

/**
 * A nestable timeline: a range-gated, tickable `Group` — `Sequence` semantics
 * without the per-layer canvas. Drop a `Clip` anywhere inside a `Sequence`
 * (or another `Clip`) and it is visible and ticked only while the parent
 * timeline's playhead is inside `[from, from + durationInFrames)`, with its
 * updaters receiving **clip-local** frames.
 *
 * `from`/`until` take parent-local frame numbers, or `Marker` points (always
 * absolute — converted against the parent's placement). Duration defaults to
 * the remainder of the parent timeline.
 *
 * This is the building block for shareable components: a component is a plain
 * function that builds a `Clip`, registers updaters on it, and returns it.
 *
 * Note: Konva's masking props (`clip`, `clipFunc`) keep their Konva meaning
 * and work here unchanged.
 */
export class Clip extends TimelineMixin(Group) {
  constructor(opts: ClipOptions = {}) {
    const { from, durationInFrames, until, span, ...groupOpts } = opts;
    void from;
    void durationInFrames;
    void until;
    void span;
    const parsed = parseTimelineOptions("Clip", opts);
    super({ ...groupOpts, visible: false });
    this._kmInitTimeline("Clip", parsed);
    this.setAttr(CLIP_MARK, true);
    // A clip is discovered by its parent timeline as a single tickable unit;
    // it then runs its own frame pass over its own subtree.
    this.setAttr(TICK_MARK, true);
  }

  /**
   * A `Clip` lives in its parent timeline's local frames. Plain numbers pass
   * through; markers resolve absolutely and are re-based onto the parent.
   */
  override _kmResolveAnchor(anchor: FrameAnchor): number {
    if (typeof anchor === "number") return anchor;
    return anchor.resolve() - this._kmParentAbsoluteStart();
  }

  /** Default span: whatever remains of the parent timeline after `from`. */
  override _kmDefaultDuration(): number {
    const parent = nearestTimeline(this);
    if (!parent) return Number.POSITIVE_INFINITY;
    return parent.durationInFrames - this.from;
  }

  override _kmAbsoluteStart(): number {
    return this._kmParentAbsoluteStart() + this.from;
  }

  private _kmParentAbsoluteStart(): number {
    return nearestTimeline(this)?._kmAbsoluteStart() ?? 0;
  }

  /**
   * @internal the parent timeline's tick — `local` is the **parent's** local
   * frame. Gates the range, computes the clip-local frame, and runs this
   * clip's own frame pass (which recurses into nested clips). No dedupe here:
   * the host `Sequence` already dedupes at its level, and a forced re-apply
   * (props `refresh()`) must reach every updater below.
   */
  _kmTick(local: number, tickMedia = true): void {
    const from = this.from;
    const inRange = local >= from && local < from + this.durationInFrames;
    if (inRange) {
      if (!this._kmActive) {
        this.visible(true);
        this._kmActive = true;
      }
      this._kmLastLocal = local - from;
      this._kmRunFrame(local - from, tickMedia);
    } else if (this._kmActive) {
      this._kmDeactivate();
    }
  }

  /**
   * @internal leave-range / host-deactivation reset: hide, drop activation
   * state, and recurse into this clip's own tickables (media pauses, nested
   * clips deactivate). Called by the range gate above and by the host
   * timeline's own deactivation walk.
   */
  _kmDeactivate(): void {
    this.visible(false);
    this._kmActive = false;
    this._kmLastLocal = -1;
    this._kmDeactivateSubtree();
  }
}

/** True for a smoove {@link Clip} — marker-based, so it survives across realms. */
export function isClip(node: Konva.Node): node is Clip {
  return node.getAttr(CLIP_MARK) === true;
}
