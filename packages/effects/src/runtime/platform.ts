import type { EffectChainResult } from "@smoove/core";
import type { GlContext } from "./shared.js";
import { VERTEX_SHADER } from "./shared.js";

/**
 * GL backend for the effect runtime. Field-compatible with
 * @smoove/transitions' GlPlatform (gl/vertexShader/prepareFragment/resize/
 * uploadScene) so the renderer builds both from one headless-gl setup, but
 * `result` returns a source-rect alongside the image (the drawing buffer may
 * be larger than the requested size) and `flipFinalPass` lets a readback
 * backend keep texture orientation on the final pass instead of paying a CPU
 * row-flip after `readPixels`.
 */
export interface EffectGlPlatform {
  readonly gl: GlContext;
  readonly vertexShader: string;
  /**
   * `false` when the backend reads pixels back (server): the final pass then
   * renders un-flipped so the bottom-up `readPixels` comes out top-down for
   * free. Defaults to `true` (canvas displayed directly).
   */
  readonly flipFinalPass?: boolean;
  prepareFragment(fragment: string): string;
  /** Ensure the drawing buffer can hold `width × height` (may over-allocate). */
  resize(width: number, height: number): void;
  uploadScene(source: CanvasImageSource, width: number, height: number): void;
  result(width: number, height: number): EffectChainResult;
}

/** Browser WebGL2 platform drawing into an offscreen canvas; `null` when unavailable. */
export function createBrowserPlatform(): EffectGlPlatform | null {
  if (typeof document === "undefined") return null;
  let canvas: HTMLCanvasElement;
  try {
    canvas = document.createElement("canvas");
  } catch {
    return null;
  }
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true });
  if (!gl) return null;
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  return {
    gl,
    vertexShader: VERTEX_SHADER,
    prepareFragment: (fragment) => fragment,
    resize(width, height) {
      // Grow-only: shrinking and re-growing the drawing buffer every frame
      // (node region one moment, ShaderSource size the next) reallocates it
      // each time. Chains render into a viewport sub-rect instead and report
      // the source-rect via result().
      if (canvas.width < width) canvas.width = width;
      if (canvas.height < height) canvas.height = height;
    },
    uploadScene(source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
    },
    result(_width, height) {
      // The viewport is anchored at GL (0,0) — the bottom-left of the canvas —
      // so in canvas display coordinates the content sits at the bottom.
      return { image: canvas, sx: 0, sy: canvas.height - height };
    },
  };
}
