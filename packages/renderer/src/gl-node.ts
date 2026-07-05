import { type GlPlatform, transpileTo100, VERTEX_SHADER_100 } from "@smoove/transitions";
// Imported from the bare "module" specifier (not "node:module") on purpose: a
// consuming app may alias `node:module` to a browser stub for its client bundle
// (the demo and the create-smoove templates do), and `resolve.alias` applies to
// the SSR graph too — a `node:module` import here would resolve to the stub and
// silently disable headless-gl (no shader transitions/effects in server renders).
// biome-ignore lint/style/useNodejsImportProtocol: bare "module" deliberately dodges a `node:module` client alias.
import { createRequire } from "module";
import type { Canvas, ImageData as SkiaImageData } from "skia-canvas";
import { cpuCanvas } from "./skia.js";

const require = createRequire(import.meta.url);

/** Minimal shape of the `headless-gl` factory (no published types). */
type HeadlessGlFactory = (
  width: number,
  height: number,
  options?: Record<string, unknown>,
) => WebGLRenderingContext | null;

type ResizeExt = { resize(width: number, height: number): void };

export type NodeGlPlatformOptions = {
  /**
   * When true the caller renders the final pass un-flipped (effects runtime
   * with `flipFinalPass: false`): the bottom-up `readPixels` then comes out
   * top-down by itself and the CPU row-flip loop is skipped entirely.
   */
  rawReadback?: boolean;
};

/**
 * A {@link GlPlatform} backed by `headless-gl` (off-DOM WebGL1) and skia-canvas.
 * Scenes are uploaded as raw RGBA via `texImage2D`, the GLSL ES 3.00 fragments
 * are transpiled to 1.00, and the drawn frame is read back with `readPixels`
 * into a retained per-size `ImageData` (no per-frame allocation) on a skia
 * `Canvas` Konva can draw. Returns `null` if `headless-gl` isn't installed or
 * can't get a context.
 */
export function createNodeGlPlatform(opts: NodeGlPlatformOptions = {}): GlPlatform | null {
  let createGl: HeadlessGlFactory;
  try {
    createGl = require("gl") as HeadlessGlFactory;
  } catch {
    return null;
  }

  const gl = createGl(1, 1, { preserveDrawingBuffer: true, premultipliedAlpha: true });
  if (!gl) return null;
  const resizeExt = gl.getExtension("STACKGL_resize_drawingbuffer") as ResizeExt | null;

  let bufWidth = 1;
  let bufHeight = 1;
  // Retained per-size readback targets: readPixels writes straight into the
  // ImageData's buffer, which putImageData blits onto a CPU skia surface —
  // zero intermediate copies, no per-frame allocation. A few sizes stay live
  // in mixed comps (node regions + layer size); cap and evict the oldest.
  type Readback = {
    out: Canvas;
    img: SkiaImageData;
    view: Uint8Array;
    pixels?: Uint8Array;
    at: number;
  };
  const readbacks = new Map<string, Readback>();
  let tick = 0;

  const readback = (width: number, height: number): Readback => {
    const key = `${width}x${height}`;
    const hit = readbacks.get(key);
    if (hit) {
      hit.at = ++tick;
      return hit;
    }
    // CPU surface: it's written with putImageData and blitted into
    // CPU-rasterized layer canvases (see skia.ts) — a GPU surface here just
    // adds readbacks.
    const out = cpuCanvas(width, height);
    const img = out.getContext("2d").createImageData(width, height);
    const r: Readback = {
      out,
      img,
      view: new Uint8Array(img.data.buffer as ArrayBuffer),
      at: ++tick,
    };
    readbacks.set(key, r);
    if (readbacks.size > 8) {
      let oldestKey: string | null = null;
      let oldest = Number.POSITIVE_INFINITY;
      for (const [k, v] of readbacks) {
        if (v.at < oldest) {
          oldest = v.at;
          oldestKey = k;
        }
      }
      if (oldestKey) readbacks.delete(oldestKey);
    }
    return r;
  };

  return {
    gl,
    vertexShader: VERTEX_SHADER_100,
    prepareFragment: transpileTo100,

    resize(width, height) {
      // Grow-only: chains render into a viewport sub-rect anchored at GL
      // (0,0), so mixed sizes per frame don't reallocate the software buffer.
      if (width <= bufWidth && height <= bufHeight) return;
      bufWidth = Math.max(bufWidth, width);
      bufHeight = Math.max(bufHeight, height);
      resizeExt?.resize(bufWidth, bufHeight);
    },

    uploadScene(source, width, height) {
      // `source` is a skia Canvas at render time; pull straight-alpha RGBA bytes.
      const ctx = (source as unknown as Canvas).getContext("2d");
      const data = ctx.getImageData(0, 0, width, height).data;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    },

    result(width, height) {
      const r = readback(width, height);
      const ctx = r.out.getContext("2d");
      // reset() truncates skia's recorded display list — putImageData every
      // frame otherwise accumulates commands that downstream reads (Konva's
      // drawImage of this canvas) replay in full, degrading quadratically.
      (ctx as unknown as { reset?(): void }).reset?.();
      if (opts.rawReadback) {
        // Final pass rendered un-flipped: bottom-up readPixels is top-down data.
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, r.view);
      } else {
        if (!r.pixels) r.pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, r.pixels);
        const row = width * 4;
        // GL framebuffer is bottom-up; flip rows into a top-down image.
        for (let y = 0; y < height; y++) {
          r.img.data.set(r.pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
        }
      }
      ctx.putImageData(r.img, 0, 0);
      return r.out as unknown as CanvasImageSource;
    },
  };
}
