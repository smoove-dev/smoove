import type { GlContext } from "./shared.js";

type CanvasImage = HTMLCanvasElement | OffscreenCanvas;

/**
 * Extra per-effect uniforms uploaded each frame, keyed by GLSL uniform name.
 * A `number` → `uniform1f`; a `number[]` of length 2/3/4 →
 * `uniform2f`/`uniform3f`/`uniform4f`.
 */
export type GlUniforms = Record<string, number | number[]>;

/**
 * A rendering backend for GL work (shader transitions, shader effect passes).
 * The DOM and Node (skia + headless-gl) environments share all the WebGL
 * plumbing but differ in three places: which GLSL dialect the program is
 * compiled in, how a captured scene canvas is uploaded into a texture, and how
 * the drawn frame is handed back to Konva.
 */
export interface GlPlatform {
  /** The (WebGL1 or WebGL2) context to draw into. */
  readonly gl: GlContext;
  /** Vertex shader matching this platform's GLSL dialect. */
  readonly vertexShader: string;
  /** Adapt a `#version 300 es` fragment to this platform's dialect (identity on WebGL2). */
  prepareFragment(fragment: string): string;
  /** Resize the backing draw buffer before a frame. */
  resize(width: number, height: number): void;
  /**
   * Upload `source` into the currently bound `TEXTURE_2D` (the caller has
   * already selected the texture unit and bound the texture).
   */
  uploadScene(source: CanvasImage, width: number, height: number): void;
  /**
   * After `drawArrays`, return an image Konva can draw (reused across calls —
   * copy/draw it immediately).
   */
  result(width: number, height: number): CanvasImageSource;
}
