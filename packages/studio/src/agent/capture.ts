import type { Composition } from "@smoove/core";

/**
 * Make sure every layer's backing canvas holds at least `ratio` pixels per
 * composition pixel, so a capture at the requested width isn't upscaled from a
 * small on-screen canvas. Returns an undo that puts the original ratios back.
 * Raising a ratio clears that canvas; the caller redraws before the browser
 * paints.
 */
export function ensurePixelRatio(comp: Composition, ratio: number): () => void {
  const changed: Array<[ReturnType<Composition["getLayers"]>[number], number]> = [];
  for (const layer of comp.getLayers()) {
    const canvas = layer.getCanvas();
    const current = canvas.getPixelRatio();
    if (current + 1e-6 < ratio) {
      changed.push([layer, current]);
      canvas.setPixelRatio(ratio);
    }
  }
  return () => {
    for (const [layer, old] of changed) layer.getCanvas().setPixelRatio(old);
  };
}

/** Synchronously redraw every visible layer, so its canvas is current. */
export function redrawVisible(comp: Composition): void {
  for (const layer of comp.getLayers()) {
    if (layer.visible()) layer.drawScene();
  }
}

/**
 * Copy `source` into a new canvas `width` × `height`. Halves in steps first,
 * since one big downscale with bilinear smoothing drops detail.
 */
export function scaleCanvas(
  source: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  let cur: HTMLCanvasElement = source;
  while (cur.width / 2 >= width && cur.height / 2 >= height) {
    const half = makeCanvas(Math.round(cur.width / 2), Math.round(cur.height / 2));
    draw(half, cur);
    cur = half;
  }
  const out = makeCanvas(width, height);
  draw(out, cur);
  return out;
}

/**
 * Encode as PNG. Synchronous on purpose: Chrome runs `toBlob` in idle time, and
 * a busy studio tab has none, so `toBlob` sat about a second on its fallback
 * deadline. `toDataURL` costs a few milliseconds at snapshot sizes.
 */
export function encodePng(canvas: HTMLCanvasElement): Blob {
  const url = canvas.toDataURL("image/png");
  const base64 = url.slice(url.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function draw(target: HTMLCanvasElement, source: HTMLCanvasElement): void {
  const ctx = target.getContext("2d");
  if (!ctx) throw new Error("The browser couldn't create a 2D canvas for the snapshot.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, target.width, target.height);
}
