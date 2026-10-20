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
 * the preview (a studio snapshot, say) waits for the right video frame. A tick
 * that arrives while the source is still loading holds one too, until the
 * source is ready and has seeked to the latest frame asked for. Playback never
 * waits on render handles, so this costs the clock nothing.
 */
/** How long a load may hold `renderFrame()` before the preview gives up on it. */
const LOAD_WAIT_MS = 10_000;

export class PreviewVideoDriver implements VideoDriver {
  private readonly handles = new Set<number>();
  /** The frame the latest tick asked for while the source was still loading. */
  private waitingFrame: number | null = null;

  constructor(private readonly ctx: VideoDriverContext) {}

  tick(localFrame: number): void {
    const { source } = this.ctx;
    if (!source.isReady) {
      this.waitForReady(localFrame);
      this.ctx.redraw();
      return;
    }
    this.seek(localFrame);
    this.ctx.redraw();
  }

  /** Hold one render handle until the source loads, then seek to the latest frame. */
  private waitForReady(localFrame: number): void {
    const first = this.waitingFrame === null;
    this.waitingFrame = localFrame;
    if (!first) return;
    const handle = this.ctx.comp.delayRender("preview video load");
    this.handles.add(handle);
    let off: (() => void) | null = null;
    const done = (): void => {
      off?.();
      clearTimeout(fallback);
      const frame = this.waitingFrame;
      this.waitingFrame = null;
      if (frame !== null && this.ctx.source.isReady) this.seek(frame);
      this.release(handle);
    };
    // A file that never loads must not hold a snapshot forever.
    const fallback = setTimeout(done, LOAD_WAIT_MS);
    off = this.ctx.source.onReady(() => queueMicrotask(done));
  }

  private seek(localFrame: number): void {
    const { source, comp } = this.ctx;
    const expected = getMediaTime(localFrame, this.ctx.timing);
    const handle = comp.delayRender("preview video seek");
    this.handles.add(handle);
    void source
      .seek(expected)
      .then(() => this.ctx.redraw())
      .finally(() => this.release(handle));
  }

  deactivate(): void {
    this.ctx.source.pause();
  }

  /** A dropped source never settles its queued seeks, so release their handles here. */
  dispose(): void {
    this.waitingFrame = null;
    for (const handle of [...this.handles]) this.release(handle);
  }

  private release(handle: number): void {
    if (this.handles.delete(handle)) this.ctx.comp.continueRender(handle);
  }
}
