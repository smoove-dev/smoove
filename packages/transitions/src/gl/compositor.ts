import type { GlUniforms } from "../types.js";
import { createProgram, createTexture } from "./shared.js";

type CanvasImage = HTMLCanvasElement | OffscreenCanvas;

type ProgramEntry = {
  program: WebGLProgram;
  uTime: WebGLUniformLocation | null;
  uPrev: WebGLUniformLocation | null;
  uNext: WebGLUniformLocation | null;
  extra: Map<string, WebGLUniformLocation | null>;
};

/**
 * One shared WebGL2 surface that runs any Tier B fragment shader over two
 * captured scene canvases. `u_prev` is bound to the **incoming** scene and
 * `u_next` to the **outgoing** scene (Remotion's inverted binding); `u_time` is
 * the transition progress. Pure in `(progress, textures)` → reproducible.
 */
export class GlCompositor {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly prevTex: WebGLTexture;
  private readonly nextTex: WebGLTexture;
  private readonly programs = new Map<string, ProgramEntry>();

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.prevTex = createTexture(gl);
    this.nextTex = createTexture(gl);
  }

  /** Create a compositor, or `null` when no WebGL2 context is available. */
  static create(): GlCompositor | null {
    if (typeof document === "undefined") return null;
    let canvas: HTMLCanvasElement;
    try {
      canvas = document.createElement("canvas");
    } catch {
      return null;
    }
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true });
    if (!gl) return null;
    return new GlCompositor(canvas, gl);
  }

  private getEntry(fragment: string, extraNames: string[]): ProgramEntry {
    let entry = this.programs.get(fragment);
    if (!entry) {
      const program = createProgram(this.gl, fragment);
      entry = {
        program,
        uTime: this.gl.getUniformLocation(program, "u_time"),
        uPrev: this.gl.getUniformLocation(program, "u_prev"),
        uNext: this.gl.getUniformLocation(program, "u_next"),
        extra: new Map(),
      };
      this.programs.set(fragment, entry);
    }
    for (const name of extraNames) {
      if (!entry.extra.has(name)) {
        entry.extra.set(name, this.gl.getUniformLocation(entry.program, name));
      }
    }
    return entry;
  }

  /**
   * Render the blended frame and return the backing canvas (reused across
   * calls — copy/draw it immediately).
   */
  render(
    fragment: string,
    incoming: CanvasImage,
    outgoing: CanvasImage,
    progress: number,
    uniforms: GlUniforms,
    width: number,
    height: number,
  ): HTMLCanvasElement {
    const gl = this.gl;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;

    const extraNames = Object.keys(uniforms);
    const entry = this.getEntry(fragment, extraNames);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(entry.program);

    const aPos = gl.getAttribLocation(entry.program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.prevTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, incoming);
    gl.uniform1i(entry.uPrev, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.nextTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, outgoing);
    gl.uniform1i(entry.uNext, 1);

    gl.uniform1f(entry.uTime, progress);

    for (const [name, value] of Object.entries(uniforms)) {
      const loc = entry.extra.get(name) ?? null;
      if (loc === null) continue;
      if (typeof value === "number") {
        gl.uniform1f(loc, value);
      } else if (value.length === 2) {
        gl.uniform2f(loc, value[0] as number, value[1] as number);
      } else if (value.length === 3) {
        gl.uniform3f(loc, value[0] as number, value[1] as number, value[2] as number);
      } else if (value.length === 4) {
        gl.uniform4f(
          loc,
          value[0] as number,
          value[1] as number,
          value[2] as number,
          value[3] as number,
        );
      }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}

let cached: GlCompositor | null | undefined;

/** Lazily create (and memoize) the shared compositor; `null` if no WebGL2. */
export function getCompositor(): GlCompositor | null {
  if (cached === undefined) cached = GlCompositor.create();
  return cached;
}
