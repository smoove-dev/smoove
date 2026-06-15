// Imported from the bare "module" specifier (not "node:module") on purpose: a
// consuming app may alias `node:module` to a browser stub for its client bundle
// (this renderer is server-only, so that stub must never reach it). Vite/Node
// still resolve "module" to the real Node builtin in the SSR/server runtime.
// biome-ignore lint/style/useNodejsImportProtocol: bare "module" deliberately dodges a `node:module` client alias.
import { createRequire } from "module";
import { type GlPlatform, VERTEX_SHADER_100, transpileTo100 } from "@konva-motion/transitions";
import { Canvas } from "skia-canvas";

const require = createRequire(import.meta.url);

/** Minimal shape of the `headless-gl` factory (no published types). */
type HeadlessGlFactory = (
  width: number,
  height: number,
  options?: Record<string, unknown>,
) => WebGLRenderingContext | null;

type ResizeExt = { resize(width: number, height: number): void };

/**
 * A {@link GlPlatform} backed by `headless-gl` (off-DOM WebGL1) and skia-canvas.
 * Scenes are uploaded as raw RGBA via `texImage2D`, the GLSL ES 3.00 fragments
 * are transpiled to 1.00, and the drawn frame is read back with `readPixels`
 * (flipped from GL's bottom-up framebuffer) into a skia `Canvas` that Konva can
 * draw. Returns `null` if `headless-gl` isn't installed or can't get a context.
 */
export function createNodeGlPlatform(): GlPlatform | null {
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
  let pixels = new Uint8Array(4);
  let out = new Canvas(1, 1);

  return {
    gl,
    vertexShader: VERTEX_SHADER_100,
    prepareFragment: transpileTo100,

    resize(width, height) {
      if (width === bufWidth && height === bufHeight) return;
      resizeExt?.resize(width, height);
      bufWidth = width;
      bufHeight = height;
      pixels = new Uint8Array(width * height * 4);
      out = new Canvas(width, height);
    },

    uploadScene(source, width, height) {
      // `source` is a skia Canvas at render time; pull straight-alpha RGBA bytes.
      const ctx = (source as unknown as Canvas).getContext("2d");
      const data = ctx.getImageData(0, 0, width, height).data;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    },

    result(width, height) {
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const ctx = out.getContext("2d");
      const img = ctx.createImageData(width, height);
      const row = width * 4;
      // GL framebuffer is bottom-up; flip rows into a top-down image.
      for (let y = 0; y < height; y++) {
        img.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
      }
      ctx.putImageData(img, 0, 0);
      return out as unknown as CanvasImageSource;
    },
  };
}
