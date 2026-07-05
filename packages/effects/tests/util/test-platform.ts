// A headless-gl platform for tests: uploads raw RGBA buffers, reads results
// back as raw pixels. Returns null when the optional `gl` package is absent.
import { createRequire } from "node:module";
import type { EffectGlPlatform } from "../../src/runtime/platform.js";
import { VERTEX_SHADER_100 } from "../../src/runtime/shared.js";
import { transpileTo100 } from "../../src/runtime/transpile.js";

const require = createRequire(import.meta.url);

/** Test input/output stand-in for CanvasImageSource: raw RGBA. */
export type RawImage = { data: Uint8Array; width: number; height: number };

export function createTestPlatform(): (EffectGlPlatform & { readPixels(): Uint8Array }) | null {
  let createGl: (w: number, h: number, o?: object) => WebGLRenderingContext | null;
  try {
    createGl = require("gl");
  } catch {
    return null;
  }
  const gl = createGl(4, 4, { preserveDrawingBuffer: true, premultipliedAlpha: true });
  if (!gl) return null;
  const resizeExt = gl.getExtension("STACKGL_resize_drawingbuffer") as {
    resize(w: number, h: number): void;
  } | null;
  let bw = 4;
  let bh = 4;
  return {
    gl,
    vertexShader: VERTEX_SHADER_100,
    prepareFragment: transpileTo100,
    resize(w, h) {
      if (w === bw && h === bh) return;
      resizeExt?.resize(w, h);
      bw = w;
      bh = h;
    },
    uploadScene(source, w, h) {
      const raw = source as unknown as RawImage;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, raw.data);
    },
    result(w, h) {
      // Tests read pixels directly; return a marker object.
      return { data: this.readPixels(), width: w, height: h } as unknown as CanvasImageSource;
    },
    readPixels() {
      const px = new Uint8Array(bw * bh * 4);
      gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    },
  };
}

export function solid(r: number, g: number, b: number, a: number, w = 4, h = 4): RawImage {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([r, g, b, a], i * 4);
  return { data, width: w, height: h };
}
