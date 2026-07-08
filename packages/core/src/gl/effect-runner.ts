import type { GlPlatform, GlUniforms } from "./platform.js";
import { createProgram, createTexture, type GlContext, VERTEX_SHADER } from "./shared.js";

type CanvasImage = HTMLCanvasElement | OffscreenCanvas;

type ProgramEntry = {
  program: WebGLProgram;
  uTime: WebGLUniformLocation | null;
  uTexture: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
  uAspect: WebGLUniformLocation | null;
  extra: Map<string, WebGLUniformLocation | null>;
};

/**
 * One shared GL surface that runs a fragment shader over a single captured
 * canvas — the `shader` effect pass. The fragment samples `u_texture` and may
 * read `u_time` (seconds, composition clock), `u_resolution` (device px), and
 * `u_textureAspectRatio`. Extra uniforms come from the pass. Pure in
 * `(fragment, texture, uniforms)` → reproducible.
 */
export class EffectShaderRunner {
  private readonly platform: GlPlatform;
  private readonly gl: GlContext;
  private readonly tex: WebGLTexture;
  private readonly programs = new Map<string, ProgramEntry>();

  private constructor(platform: GlPlatform) {
    this.platform = platform;
    this.gl = platform.gl;
    const gl = this.gl;
    // Enable derivatives (fwidth) on WebGL1; a no-op on WebGL2 where it's core.
    gl.getExtension("OES_standard_derivatives");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.tex = createTexture(gl);
  }

  /** Wrap a custom backend (e.g. the Node headless-gl platform). */
  static fromPlatform(platform: GlPlatform): EffectShaderRunner {
    return new EffectShaderRunner(platform);
  }

  /** Create a DOM/WebGL2 runner, or `null` when no WebGL2 context is available. */
  static create(): EffectShaderRunner | null {
    if (typeof document === "undefined") return null;
    let canvas: HTMLCanvasElement;
    try {
      canvas = document.createElement("canvas");
    } catch {
      return null;
    }
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true });
    if (!gl) return null;
    return new EffectShaderRunner({
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
        uTexture: this.gl.getUniformLocation(program, "u_texture"),
        uResolution: this.gl.getUniformLocation(program, "u_resolution"),
        uAspect: this.gl.getUniformLocation(program, "u_textureAspectRatio"),
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
   * Run `fragment` over `source` and return an image to draw (reused across
   * calls — copy/draw it immediately). `uniforms.u_time` (when present)
   * overrides the default `time` value, letting effects scale time by speed.
   */
  render(
    fragment: string,
    source: CanvasImage,
    uniforms: GlUniforms,
    time: number,
    width: number,
    height: number,
  ): CanvasImageSource {
    const gl = this.gl;
    this.platform.resize(width, height);

    const extraNames = Object.keys(uniforms).filter((n) => n !== "u_time");
    const entry = this.getEntry(fragment, extraNames);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(entry.program);

    const aPos = gl.getAttribLocation(entry.program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    this.platform.uploadScene(source, width, height);
    gl.uniform1i(entry.uTexture, 0);

    const t = uniforms.u_time;
    gl.uniform1f(entry.uTime, typeof t === "number" ? t : time);
    gl.uniform2f(entry.uResolution, width, height);
    gl.uniform1f(entry.uAspect, width / height);

    for (const name of extraNames) {
      const loc = entry.extra.get(name) ?? null;
      if (loc === null) continue;
      const value = uniforms[name];
      if (value === undefined) continue;
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

let cached: EffectShaderRunner | null | undefined;
let factory: (() => EffectShaderRunner | null) | null = null;

/**
 * Override how the shared shader runner is created — used by server renderers
 * to inject a headless GL backend. Clears any memoized runner so the next
 * {@link getEffectShaderRunner} call rebuilds.
 */
export function setEffectShaderFactory(create: (() => EffectShaderRunner | null) | null): void {
  factory = create;
  cached = undefined;
}

/** Lazily create (and memoize) the shared runner; `null` if unavailable. */
export function getEffectShaderRunner(): EffectShaderRunner | null {
  if (cached === undefined) cached = factory ? factory() : EffectShaderRunner.create();
  return cached;
}
