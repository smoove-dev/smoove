import { setEffectCanvasFactory } from "@smoove/core";
import { Canvas } from "skia-canvas";

let gpuOk: boolean | undefined;

/**
 * Can skia rasterize on the GPU here, correctly? Draw a red probe and read it
 * back; any driver/context failure or wrong pixels pins effects to CPU.
 */
function probeGpu(): boolean {
  try {
    const c = new Canvas(4, 4);
    c.gpu = true;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 4, 4);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return (
      c.gpu === true && (d[0] as number) > 200 && (d[1] as number) < 50 && (d[2] as number) < 50
    );
  } catch {
    return false;
  }
}

/**
 * Effects work canvases: GPU-rasterized skia for pixel-free chains (blur is
 * far faster there), CPU when the chain reads pixels back (the round trip
 * erases the GPU win). `SMOOVE_EFFECTS_GPU=0` pins everything to CPU.
 */
export function installEffectCanvases(): void {
  setEffectCanvasFactory((width, height, { gpu }) => {
    const c = new Canvas(width, height);
    if (gpu && process.env.SMOOVE_EFFECTS_GPU !== "0") {
      gpuOk ??= probeGpu();
      c.gpu = gpuOk;
    } else {
      c.gpu = false;
    }
    return c as unknown as HTMLCanvasElement;
  });
}
