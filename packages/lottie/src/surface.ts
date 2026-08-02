import Konva from "konva";

/**
 * An offscreen canvas plus the `ImageData` scratch used to push RGBA pixels
 * into it. The canvas comes from `Konva.Util.createCanvasElement()`, which the
 * skia backend patches under `@smoove/renderer` — so this file has no
 * environment branch of its own.
 */
export type LottieSurface = {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  /** Reused every frame; allocating one per frame would churn 8 MB/s at 1080p. */
  readonly scratch: ImageData | null;
};

export function createSurface(width: number, height: number): LottieSurface {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const canvas = Konva.Util.createCanvasElement();
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  return {
    canvas,
    width: w,
    height: h,
    scratch: ctx ? ctx.createImageData(w, h) : null,
  };
}

/** Return a surface of the requested size, reusing `surface` when it already matches. */
export function resizeSurface(
  surface: LottieSurface,
  width: number,
  height: number,
): LottieSurface {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (surface.width === w && surface.height === h) return surface;
  return createSurface(w, h);
}

/**
 * Copy an engine's RGBA buffer into the surface. The engine's buffer lives in
 * WASM memory and can be detached on resize, so it is always copied, never
 * retained. A short buffer is ignored rather than partially applied — a torn
 * frame is worse than a stale one.
 */
export function blit(surface: LottieSurface, rgba: Uint8Array | null): void {
  const { scratch } = surface;
  if (!rgba || !scratch) return;
  const expected = surface.width * surface.height * 4;
  if (rgba.length < expected) return;
  scratch.data.set(rgba.subarray(0, expected));
  const ctx = surface.canvas.getContext("2d");
  ctx?.putImageData(scratch, 0, 0);
}
