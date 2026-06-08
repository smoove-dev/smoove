// Side-effecting import: konva's skia backend monkey-patches
// `Konva.Util.createCanvasElement`/`createImageElement` to return skia-canvas
// objects, installs `global.DOMMatrix`/`Path2D`, and fixes the weak `ctx.canvas`
// reference. Importing this module installs the backend; it must run before any
// Konva canvas is created (i.e. before constructing a Composition).
import "konva/skia-backend";

/**
 * Ensure the konva skia backend is installed. The install happens as a side
 * effect of importing this module, so calling this is a no-op marker that
 * guarantees the import ran. Idempotent and cheap.
 */
export function installSkiaBackend(): void {
  /* installed at import time */
}
