import { createProgram, createTexture, type GlContext, VERTEX_SHADER } from "./shared.js";
import type { GlUniforms } from "./types.js";

type CanvasImage = HTMLCanvasElement | OffscreenCanvas;

type ProgramEntry = {
  program: WebGLProgram;
  /** Lazily-resolved uniform locations by name. `null` means not declared. */
  locations: Map<string, WebGLUniformLocation | null>;
};

/** Default sampler names bound by {@link GlCompositor.renderPass}. */
const DEFAULT_SAMPLERS = ["u_tex0", "u_tex1", "u_tex2", "u_tex3"];

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
 * One shared WebGL surface that runs a fragment shader over one or more
 * captured canvases. Two consumers ride it:
 *
 * - **Transitions** via {@link render}, which binds the incoming scene to
 *   `u_prev` and the outgoing to `u_next` (Remotion's inverted binding) with
 *   `u_time` as progress.
 * - **Effects** via {@link renderPass}, which binds sources to `u_tex0`,
 *   `u_tex1`, ... and sets arbitrary named uniforms.
 *
 * Both are pure in `(fragment, sources, uniforms)` → reproducible, which is
 * what lets a server render seek to any frame and get identical pixels.
 *
 * The actual GL surface is supplied by a {@link GlPlatform}: a DOM/WebGL2
 * backend in the browser, or a headless-gl/skia backend during server
 * rendering (see `@smoove/renderer/gl`).
 */
export class GlCompositor {
  private readonly platform: GlPlatform;
  private readonly gl: GlContext;
  /** Textures by sampler slot, created on first use. */
  private readonly texPool: WebGLTexture[] = [];
  private readonly programs = new Map<string, ProgramEntry>();

  private constructor(platform: GlPlatform) {
    this.platform = platform;
    this.gl = platform.gl;
    const gl = this.gl;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
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
    // Straight alpha, matching the server platform: it reads the framebuffer
    // back with `readPixels` straight into an ImageData, whose channels are not
    // premultiplied. Both consumers author their fragments the same way, so the
    // two paths would otherwise disagree on every semi-transparent pixel.
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false });
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

  private getEntry(fragment: string): ProgramEntry {
    let entry = this.programs.get(fragment);
    if (!entry) {
      const program = createProgram(
        this.gl,
        this.platform.prepareFragment(fragment),
        this.platform.vertexShader,
      );
      entry = { program, locations: new Map() };
      this.programs.set(fragment, entry);
    }
    return entry;
  }

  /** Texture for sampler slot `i`, created on first use. */
  private texture(i: number): WebGLTexture {
    let tex = this.texPool[i];
    if (!tex) {
      tex = createTexture(this.gl);
      this.texPool[i] = tex;
    }
    return tex;
  }

  /** Cached uniform location lookup; `null` when the fragment doesn't declare it. */
  private location(entry: ProgramEntry, name: string): WebGLUniformLocation | null {
    if (!entry.locations.has(name)) {
      entry.locations.set(name, this.gl.getUniformLocation(entry.program, name));
    }
    return entry.locations.get(name) ?? null;
  }

  private setUniform(entry: ProgramEntry, name: string, value: number | number[]): void {
    const gl = this.gl;
    const loc = this.location(entry, name);
    if (loc === null) return;
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

  /**
   * Run `fragment` over `sources` and return an image to draw (reused across
   * calls — copy/draw it immediately).
   *
   * Sources bind to `samplerNames[i]`, defaulting to `u_tex0`, `u_tex1`, ...
   * Uniform names the fragment doesn't declare are skipped, so a caller can
   * pass a full param set to a shader that only reads some of it.
   */
  renderPass(
    fragment: string,
    sources: readonly CanvasImage[],
    uniforms: GlUniforms,
    width: number,
    height: number,
    samplerNames: readonly string[] = DEFAULT_SAMPLERS,
  ): CanvasImageSource {
    const gl = this.gl;
    this.platform.resize(width, height);
    const entry = this.getEntry(fragment);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(entry.program);

    const aPos = gl.getAttribLocation(entry.program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    for (let i = 0; i < sources.length; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.texture(i));
      this.platform.uploadScene(sources[i] as CanvasImage, width, height);
      const name = samplerNames[i];
      if (name === undefined) continue;
      const loc = this.location(entry, name);
      if (loc !== null) gl.uniform1i(loc, i);
    }

    for (const [name, value] of Object.entries(uniforms)) {
      this.setUniform(entry, name, value);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.platform.result(width, height);
  }

  /**
   * Render a transition frame. `u_prev` is the **incoming** scene and `u_next`
   * the **outgoing** one (Remotion's inverted binding); `u_time` is progress.
   *
   * A thin wrapper over {@link renderPass} that keeps the transition's uniform
   * names, so the two consumers share one code path.
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
    return this.renderPass(
      fragment,
      [incoming, outgoing],
      { ...uniforms, u_time: progress },
      width,
      height,
      ["u_prev", "u_next"],
    );
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
