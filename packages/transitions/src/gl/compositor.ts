import type { GlUniforms } from "../types.js";
import { type GlContext, VERTEX_SHADER, createProgram, createTexture } from "./shared.js";

type CanvasImage = HTMLCanvasElement | OffscreenCanvas;

type ProgramEntry = {
  program: WebGLProgram;
  uTime: WebGLUniformLocation | null;
  uPrev: WebGLUniformLocation | null;
  uNext: WebGLUniformLocation | null;
  extra: Map<string, WebGLUniformLocation | null>;
};

/**
 * A rendering backend for the compositor. The DOM and Node (skia + headless-gl)
 * environments share all the WebGL plumbing but differ in three places: which
 * GLSL dialect the program is compiled in, how a captured scene canvas is
 * uploaded into a texture, and how the drawn frame is handed back to Konva.
 */
export interface GlPlatform {
  /** The (WebGL1 or WebGL2) context the compositor draws into. */
  readonly gl: GlContext;
  /** Vertex shader matching this platform's GLSL dialect. */
  readonly vertexShader: string;
  /** Adapt a `#version 300 es` fragment to this platform's dialect (identity on WebGL2). */
  prepareFragment(fragment: string): string;
  /** Resize the backing draw buffer before a frame. */
  resize(width: number, height: number): void;
  /**
   * Upload `source` into the currently bound `TEXTURE_2D` (the compositor has
   * already selected the texture unit and bound the texture).
   */
  uploadScene(source: CanvasImage, width: number, height: number): void;
  /**
   * After `drawArrays`, return an image Konva can draw (reused across calls —
   * copy/draw it immediately).
   */
  result(width: number, height: number): CanvasImageSource;
}

/**
 * One shared WebGL surface that runs any Tier B fragment shader over two
 * captured scene canvases. `u_prev` is bound to the **incoming** scene and
 * `u_next` to the **outgoing** scene (Remotion's inverted binding); `u_time` is
 * the transition progress. Pure in `(progress, textures)` → reproducible.
 *
 * The actual GL surface is supplied by a {@link GlPlatform}: a DOM/WebGL2
 * backend in the browser, or a headless-gl/skia backend during server
 * rendering (see `@konva-motion/renderer/gl`).
 */
export class GlCompositor {
  private readonly platform: GlPlatform;
  private readonly gl: GlContext;
  private readonly prevTex: WebGLTexture;
  private readonly nextTex: WebGLTexture;
  private readonly programs = new Map<string, ProgramEntry>();

  private constructor(platform: GlPlatform) {
    this.platform = platform;
    this.gl = platform.gl;
    const gl = this.gl;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.prevTex = createTexture(gl);
    this.nextTex = createTexture(gl);
  }

  /** Wrap a custom backend (e.g. the Node headless-gl platform). */
  static fromPlatform(platform: GlPlatform): GlCompositor {
    return new GlCompositor(platform);
  }

  /** Create a DOM/WebGL2 compositor, or `null` when no WebGL2 context is available. */
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
    return new GlCompositor({
      gl,
      vertexShader: VERTEX_SHADER,
      prepareFragment: (fragment) => fragment,
      resize(width, height) {
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
      },
      uploadScene(source) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      },
      result() {
        return canvas;
      },
    });
  }

  private getEntry(fragment: string, extraNames: string[]): ProgramEntry {
    let entry = this.programs.get(fragment);
    if (!entry) {
      const program = createProgram(
        this.gl,
        this.platform.prepareFragment(fragment),
        this.platform.vertexShader,
      );
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
   * Render the blended frame and return an image to draw (reused across calls —
   * copy/draw it immediately).
   */
  render(
    fragment: string,
    incoming: CanvasImage,
    outgoing: CanvasImage,
    progress: number,
    uniforms: GlUniforms,
    width: number,
    height: number,
  ): CanvasImageSource {
    const gl = this.gl;
    this.platform.resize(width, height);

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
    this.platform.uploadScene(incoming, width, height);
    gl.uniform1i(entry.uPrev, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.nextTex);
    this.platform.uploadScene(outgoing, width, height);
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
    return this.platform.result(width, height);
  }
}

let cached: GlCompositor | null | undefined;
let factory: (() => GlCompositor | null) | null = null;

/**
 * Override how the shared compositor is created — used by server renderers to
 * inject a headless GL backend. Clears any memoized compositor so the next
 * {@link getCompositor} call rebuilds. Call before building a `TransitionSeries`.
 */
export function setCompositorFactory(create: (() => GlCompositor | null) | null): void {
  factory = create;
  cached = undefined;
}

/** Lazily create (and memoize) the shared compositor; `null` if unavailable. */
export function getCompositor(): GlCompositor | null {
  if (cached === undefined) cached = factory ? factory() : GlCompositor.create();
  return cached;
}
