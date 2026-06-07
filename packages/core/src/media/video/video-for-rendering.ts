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
    if (!source.isReady) {
      // The source isn't decodable yet; redraw so whatever is available shows.
      this.ctx.redraw();
      return;
    }

    const mediaTime = getMediaTime(localFrame, this.ctx.timing);
    if (mediaTime === this._lastMediaTime) {
      this.ctx.redraw();
      return;
    }
    this._lastMediaTime = mediaTime;

    const handle = comp.delayRender(`seek video -> ${mediaTime.toFixed(4)}s`);
    source
      .seek(mediaTime)
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

  deactivate(): void {
    this._lastMediaTime = Number.NaN;
  }

  dispose(): void {}
}
