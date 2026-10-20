import { getMediaTime, type VideoDriver, type VideoDriverContext } from "./driver.js";

/**
 * Realtime preview driver for a **pull-based** {@link VideoSource} (Mediabunny +
 * WebCodecs). Unlike the old `HTMLVideoElement` model — where the element played
 * on its own and we only corrected drift — nothing self-plays here: every tick we
 * seek the source to the exact media time for the current frame and redraw. The
 * frame clock is the single source of truth, so playback and scrubbing are
 * identical code paths and both land on the exact frame.
 *
 * Each seek holds a `delayRender` handle until it lands, so `renderFrame()` in
 * the preview (a studio snapshot, say) waits for the right video frame. Playback
 * never waits on render handles, so this costs the clock nothing.
 */
export class PreviewVideoDriver implements VideoDriver {
  private readonly handles = new Set<number>();

  constructor(private readonly ctx: VideoDriverContext) {}

  tick(localFrame: number): void {
    const { source, comp } = this.ctx;
    if (!source.isReady) {
      this.ctx.redraw();
      return;
    }
    const expected = getMediaTime(localFrame, this.ctx.timing);
    const handle = comp.delayRender("preview video seek");
    this.handles.add(handle);
    void source
      .seek(expected)
      .then(() => this.ctx.redraw())
      .finally(() => this.release(handle));
    this.ctx.redraw();
  }

  deactivate(): void {
    this.ctx.source.pause();
  }

  /** A dropped source never settles its queued seeks, so release their handles here. */
  dispose(): void {
    for (const handle of [...this.handles]) this.release(handle);
  }

  private release(handle: number): void {
    if (this.handles.delete(handle)) this.ctx.comp.continueRender(handle);
  }
}
