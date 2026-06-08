import type { LoadedImage } from "@konva-motion/core";
import { loadImage } from "skia-canvas";

/**
 * Server image loader backed by skia-canvas. Returns a drawable usable by the
 * konva skia backend. skia-canvas `Image` exposes `width`/`height` but not
 * `naturalWidth`/`naturalHeight`, which `@konva-motion/core`'s `Image` layout
 * reads — so we define them from the decoded dimensions.
 */
export async function loadImageNode(src: string): Promise<LoadedImage> {
  const img = await loadImage(src);
  Object.defineProperty(img, "naturalWidth", {
    get: () => img.width,
    configurable: true,
  });
  Object.defineProperty(img, "naturalHeight", {
    get: () => img.height,
    configurable: true,
  });
  return img as unknown as LoadedImage;
}
