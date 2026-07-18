import type { Composition, MediaTiming, VideoSource } from "@smoove/core";
import { getMediaTime } from "@smoove/core";

/** Resolved per-video timing — alias of the shared {@link MediaTiming}. */
export type VideoTiming = MediaTiming;

export { getMediaTime };

/**
 * What a driver needs from the host {@link Video}: the media source, the
 * resolved timing, the owning composition (for the render gate + play state),
 * and a redraw hook (relayout + batchDraw).
 */
export type VideoDriverContext = {
  readonly source: VideoSource;
  readonly timing: VideoTiming;
  readonly comp: Composition;
  redraw(): void;
};

/**
 * Strategy that maps the composition's current frame onto the media. Mirrors
 * Remotion's split between `VideoForRendering` and `VideoForPreview`.
 */
export interface VideoDriver {
  /** Called by Sequence each tick while the video is on-stage (`localFrame` = frame - sequence.from). */
  tick(localFrame: number): void;
  /** Called by Sequence when the video leaves range. */
  deactivate(): void;
  /** Release any subscriptions; called on `Video.destroy()`. */
  dispose(): void;
}
