import { type VideoDriver, type VideoDriverContext, getMediaTime } from "./driver.js";

/**
 * Realtime preview driver for a **pull-based** {@link VideoSource} (Mediabunny +
 * WebCodecs). Unlike the old `HTMLVideoElement` model — where the element played
 * on its own and we only corrected drift — nothing self-plays here: every tick we
 * seek the source to the exact media time for the current frame and redraw. The
 * frame clock is the single source of truth, so playback and scrubbing are
 * identical code paths and both land on the exact frame.
 */
export class PreviewVideoDriver implements VideoDriver {
  constructor(private readonly ctx: VideoDriverContext) {}

  tick(localFrame: number): void {
    const { source } = this.ctx;
    if (!source.isReady) {
      this.ctx.redraw();
      return;
    }
    const expected = getMediaTime(localFrame, this.ctx.timing);
    void source.seek(expected).then(() => this.ctx.redraw());
    this.ctx.redraw();
  }

  deactivate(): void {
    this.ctx.source.pause();
  }

  dispose(): void {}
}
