import type { GlContext } from "./shared.js";
import { VERTEX_SHADER } from "./shared.js";

/** Structurally identical to @smoove/transitions' GlPlatform on purpose — the renderer reuses one headless-gl platform for both. */
export interface EffectGlPlatform {
  readonly gl: GlContext;
  readonly vertexShader: string;
  prepareFragment(fragment: string): string;
  resize(width: number, height: number): void;
  uploadScene(source: CanvasImageSource, width: number, height: number): void;
  result(width: number, height: number): CanvasImageSource;
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
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    },
    uploadScene(source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
    },
    result() {
      return canvas;
    },
  };
}
