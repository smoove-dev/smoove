import type { Composition } from "../../engine/composition.js";
import type { MediaTiming } from "../media-time.js";
import type { AudioSource } from "./audio-source.js";

/**
 * What an audio driver needs from the host {@link Audio}: the media source, the
 * resolved timing, the owning composition (for play state + asset collection),
 * the source identity, and getters for the effective audio level so a render
 * driver can record it. No `redraw` — audio paints nothing.
 */
export type AudioDriverContext = {
  readonly source: AudioSource;
  readonly timing: MediaTiming;
  readonly comp: Composition;
  readonly id: string;
  readonly src: string;
  /** Effective level (master × intrinsic), 0..1, at the current frame. */
  effectiveVolume(): number;
  /** Effective mute (masterMuted || intrinsicMuted) at the current frame. */
  effectiveMuted(): boolean;
};

/**
 * Strategy that maps the composition's current frame onto the audio. Mirrors
 * {@link VideoDriver}: a realtime preview driver and a deterministic render
 * driver (which collects assets rather than playing).
 */
export interface AudioDriver {
  /** Called by Sequence each tick while the audio is on-stage (`localFrame` = frame - sequence.from). */
  tick(localFrame: number): void;
  /** Called by Sequence when the audio leaves range. */
  deactivate(): void;
  /** Release any subscriptions; called on `Audio.destroy()`. */
  dispose(): void;
}
