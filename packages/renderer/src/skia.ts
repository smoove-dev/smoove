// Side-effecting import: konva's skia backend monkey-patches
// `Konva.Util.createCanvasElement`/`createImageElement` to return skia-canvas
// objects, installs `global.DOMMatrix`/`Path2D`, and fixes the weak `ctx.canvas`
// reference. Importing this module installs the backend; it must run before any
// Konva canvas is created (i.e. before constructing a Composition).
import "konva/skia-backend";
import { Context } from "konva/lib/Context.js";

type RawContext = CanvasRenderingContext2D & { reset?(): void };

let clearPatched = false;

/**
 * Make a full-canvas `Context.clear()` truncate skia's recording.
 *
 * skia-canvas records every draw command and replays the whole history on each
 * pixel read, and `clearRect` only appends to that history. A layer canvas is
 * cleared and redrawn every frame, so with `clearRect` it keeps every frame it
 * ever drew, video frames included: memory grows by megabytes per frame and
 * every read gets slower. `reset()` drops the history; the transform and
 * smoothing Konva set up at `setSize` are put back after it.
 */
function patchFullClear(): void {
  if (clearPatched) return;
  clearPatched = true;
  const proto = Context.prototype as unknown as {
    clear(this: Context, bounds?: unknown): void;
  };
  const clear = proto.clear;
  proto.clear = function (this: Context, bounds?: unknown) {
    const raw = this._context as RawContext;
    if (bounds || typeof raw.reset !== "function") return clear.call(this, bounds);
    const transform = raw.getTransform();
    const smoothing = raw.imageSmoothingEnabled;
    raw.reset();
    raw.setTransform(transform);
    raw.imageSmoothingEnabled = smoothing;
  };
}

patchFullClear();

/**
 * Ensure the konva skia backend is installed. The install happens as a side
 * effect of importing this module, so calling this is a no-op marker that
 * guarantees the import ran. Idempotent and cheap.
 */
export function installSkiaBackend(): void {
  /* installed at import time */
}
