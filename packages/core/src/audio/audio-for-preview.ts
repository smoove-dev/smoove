import { getMediaTime } from "../media-time.js";
import type { AudioDriver, AudioDriverContext } from "./audio-driver.js";

/**
 * Realtime playback synced to the frame clock — the audio counterpart of
 * `PreviewVideoDriver`. Lets the media play on its own and only seeks to correct
 * drift beyond `ACCEPTABLE_TIME_SHIFT`; when the composition is paused
 * (scrubbing via `setFrame`) it seeks to the exact frame.
 */
const ACCEPTABLE_TIME_SHIFT = 0.45;
const SCRUB_SEEK_THRESHOLD = 0.01;

export class PreviewAudioDriver implements AudioDriver {
  private _wasActive = false;
  private _lastLocalFrame = 0;
  private readonly _unsub: () => void;

  constructor(private readonly ctx: AudioDriverContext) {
    // React to play/pause transitions on the composition, re-anchoring the media.
    this._unsub = ctx.comp.isPlaying.subscribe((playing) => {
      if (!this._wasActive || !ctx.source.isReady) return;
      const expected = getMediaTime(this._lastLocalFrame, ctx.timing);
      void ctx.source.seek(expected);
      if (playing) {
        ctx.source.play().catch((err: unknown) => {
          console.warn("[konva-motion] audio play() rejected:", err);
        });
      } else {
        ctx.source.pause();
      }
    });
  }

  tick(localFrame: number): void {
    this._lastLocalFrame = localFrame;
    const { source, comp } = this.ctx;
    if (!source.isReady) return;

    const expected = getMediaTime(localFrame, this.ctx.timing);
    const justActivated = !this._wasActive;
    this._wasActive = true;

    if (comp.isPlaying.get()) {
      const drift = Math.abs(source.currentTime - expected);
      // On (re)activation seek hard so audio resumes at the right point;
      // otherwise let the element play and only correct large drift.
      if (justActivated || drift > ACCEPTABLE_TIME_SHIFT) {
        void source.seek(expected);
        if (justActivated) {
          source.play().catch((err: unknown) => {
            console.warn("[konva-motion] audio play() rejected:", err);
          });
        }
      }
    } else {
      // Paused / scrubbing — fast (keyframe) seek keeps dragging snappy.
      source.pause();
      if (Math.abs(source.currentTime - expected) > SCRUB_SEEK_THRESHOLD) {
        void source.seek(expected, "fast");
      }
    }
  }

  deactivate(): void {
    this._wasActive = false;
    this.ctx.source.pause();
  }

  dispose(): void {
    this._unsub();
  }
}
