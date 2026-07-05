// Side-effecting import: konva's skia backend monkey-patches
// `Konva.Util.createCanvasElement`/`createImageElement` to return skia-canvas
// objects, installs `global.DOMMatrix`/`Path2D`, and fixes the weak `ctx.canvas`
// reference. Importing this module installs the backend; it must run before any
// Konva canvas is created (i.e. before constructing a Composition).
import "konva/skia-backend";
import Konva from "konva";
import { Canvas } from "skia-canvas";

let patched = false;

/** A skia Canvas pinned to CPU rasterization (see {@link installSkiaBackend} for why). */
export function cpuCanvas(width: number, height: number): Canvas {
  const canvas = new Canvas(width, height);
  canvas.gpu = false;
  return canvas;
}

/**
 * Ensure the konva skia backend is installed. The install happens as a side
 * effect of importing this module, so calling this is a no-op marker that
 * guarantees the import ran. Idempotent and cheap.
 *
 * On top of the backend it forces **CPU rasterization** on every canvas Konva
 * creates. skia-canvas defaults to GPU (Metal/Vulkan) surfaces, and under the
 * offline render loop — many large per-frame `toCanvas` captures, `putImageData`
 * blits from headless-gl, and a full-frame readback per frame — the GPU backend
 * intermittently rasterizes garbage (uninitialized-surface magenta) after a few
 * frames. Offline rendering reads every frame back to the CPU anyway, so GPU
 * surfaces buy nothing here; CPU rasterization is deterministic and just as fast
 * for this workload.
 */
export function installSkiaBackend(): void {
  if (patched) return;
  patched = true;
  const create = Konva.Util.createCanvasElement.bind(Konva.Util);
  Konva.Util.createCanvasElement = () => {
    const canvas = create();
    (canvas as unknown as Canvas).gpu = false;
    return canvas;
  };
}
