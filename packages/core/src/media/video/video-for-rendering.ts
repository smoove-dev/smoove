import { type VideoDriver, type VideoDriverContext, getMediaTime } from "./driver.js";

/**
 * Deterministic, gated frame production — Remotion's `VideoForRendering`. Never
 * plays in realtime: each tick seeks the source to the exact media time and
 * holds a `delayRender` handle so `Composition.renderFrame()` waits for the
 * decoded frame before the canvas is captured.
 */
export class RenderingVideoDriver implements VideoDriver {
  private _lastMediaTime = Number.NaN;

  constructor(private readonly ctx: VideoDriverContext) {}

  tick(localFrame: number): void {
    const { source, comp } = this.ctx;
    const mediaTime = getMediaTime(localFrame, this.ctx.timing);
    // Already decoded this exact frame and the source is live — just redraw.
    if (source.isReady && mediaTime === this._lastMediaTime) {
      this.ctx.redraw();
      return;
    }
    this._lastMediaTime = mediaTime;

    // Gate the frame: wait for the source to become decodable (the async
    // `load()` fired in the constructor may still be in flight), then seek to
    // the exact media time. Holding the handle across both steps is what keeps
    // `renderFrame()` from capturing a blank frame before the video is ready.
    const handle = comp.delayRender(`seek video -> ${mediaTime.toFixed(4)}s`);
    this._waitReady()
      .then(() => source.seek(mediaTime))
      .then(() => {
        this.ctx.redraw();
      })
      .catch((err: unknown) => {
        console.error("[konva-motion] video seek failed during render:", err);
      })
      .finally(() => {
        comp.continueRender(handle);
      });
  }

  private _waitReady(): Promise<void> {
    const { source } = this.ctx;
    return new Promise<void>((resolve) => {
      const off = source.onReady(() => {
        off();
        resolve();
      });
      if (source.isReady) {
        off();
        resolve();
      }
    });
  }

  deactivate(): void {
    this._lastMediaTime = Number.NaN;
  }

  dispose(): void {}
}
