import {
  type EffectPass,
  type KMEffectRuntime,
  setEffectRuntime,
  type UniformValue,
} from "@smoove/core";
import { createBrowserPlatform, type EffectGlPlatform } from "./platform.js";
import { createProgram, createTexture, type GlContext } from "./shared.js";

type ProgramEntry = {
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
};

export class EffectRuntime implements KMEffectRuntime {
  /** True on a WebGL2 context (browser); false on WebGL1 (headless-gl). Some heavy sources require WebGL2. */
  readonly webgl2: boolean;
  private readonly platform: EffectGlPlatform;
  private readonly gl: GlContext;
  private readonly programs = new Map<string, ProgramEntry>();
  private readonly originalTex: WebGLTexture;
  private readonly pingTex: [WebGLTexture, WebGLTexture];
  private readonly pingFbo: [WebGLFramebuffer, WebGLFramebuffer];
  private fboWidth = 0;
  private fboHeight = 0;
  private broken = new Set<string>();

  constructor(platform: EffectGlPlatform) {
    this.platform = platform;
    this.gl = platform.gl;
    const gl = this.gl;
    this.webgl2 =
      typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
    // Enable derivatives (fwidth) on WebGL1; a no-op on WebGL2 where it's core.
    gl.getExtension("OES_standard_derivatives");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.originalTex = createTexture(gl);
    this.pingTex = [createTexture(gl), createTexture(gl)];
    const f0 = gl.createFramebuffer();
    const f1 = gl.createFramebuffer();
    if (!f0 || !f1) throw new Error("effects: failed to create framebuffers");
    this.pingFbo = [f0, f1];
  }

  private entry(fragment: string): ProgramEntry | null {
    if (this.broken.has(fragment)) return null;
    let e = this.programs.get(fragment);
    if (!e) {
      try {
        const program = createProgram(
          this.gl,
          this.platform.prepareFragment(fragment),
          this.platform.vertexShader,
        );
        e = { program, locations: new Map() };
        this.programs.set(fragment, e);
      } catch (err) {
        this.broken.add(fragment);
        console.warn("[smoove/effects] shader failed to compile — effect skipped:", err);
        return null;
      }
    }
    return e;
  }

  private loc(e: ProgramEntry, name: string): WebGLUniformLocation | null {
    if (!e.locations.has(name)) {
      const direct = this.gl.getUniformLocation(e.program, name);
      e.locations.set(name, direct ?? this.gl.getUniformLocation(e.program, `${name}[0]`));
    }
    return e.locations.get(name) ?? null;
  }

  private setUniform(e: ProgramEntry, name: string, value: UniformValue): void {
    const gl = this.gl;
    const loc = this.loc(e, name);
    if (loc === null) return;
    if (typeof value === "number") gl.uniform1f(loc, value);
    else if (typeof value === "boolean") gl.uniform1f(loc, value ? 1 : 0);
    else if (Array.isArray(value[0])) {
      const vecs = value as number[][];
      const size = vecs[0]?.length ?? 4;
      const flat = new Float32Array(vecs.length * size);
      for (let i = 0; i < vecs.length; i++) flat.set(vecs[i] as number[], i * size);
      if (size === 2) gl.uniform2fv(loc, flat);
      else if (size === 3) gl.uniform3fv(loc, flat);
      else gl.uniform4fv(loc, flat);
    } else {
      const v = value as number[];
      if (v.length === 2) gl.uniform2f(loc, v[0] as number, v[1] as number);
      else if (v.length === 3) gl.uniform3f(loc, v[0] as number, v[1] as number, v[2] as number);
      else gl.uniform4f(loc, v[0] as number, v[1] as number, v[2] as number, v[3] as number);
    }
  }

  private ensureFboSize(width: number, height: number): void {
    if (this.fboWidth === width && this.fboHeight === height) return;
    const gl = this.gl;
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.pingTex[i] as WebGLTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingFbo[i] as WebGLFramebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.pingTex[i] as WebGLTexture,
        0,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fboWidth = width;
    this.fboHeight = height;
  }

  private drawPass(
    pass: EffectPass,
    readTex: WebGLTexture | null,
    toFbo: WebGLFramebuffer | null,
    width: number,
    height: number,
  ): boolean {
    const gl = this.gl;
    const e = this.entry(pass.fragment);
    if (!e) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, toFbo);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(e.program);
    const aPos = gl.getAttribLocation(e.program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    if (readTex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readTex);
      const t = this.loc(e, "u_texture");
      if (t) gl.uniform1i(t, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.originalTex);
      const o = this.loc(e, "u_original");
      if (o) gl.uniform1i(o, 1);
    }
    this.setUniform(e, "u_resolution", [width, height]);
    // Flip only when rendering to the visible framebuffer (see shared.ts).
    this.setUniform(e, "u_flipY", toFbo === null ? 1 : 0);
    for (const [name, value] of Object.entries(pass.uniforms)) this.setUniform(e, name, value);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }

  applyChain(
    input: CanvasImageSource,
    passes: EffectPass[],
    width: number,
    height: number,
  ): CanvasImageSource | null {
    if (passes.length === 0) return null;
    const gl = this.gl;
    this.platform.resize(width, height);
    this.ensureFboSize(width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.originalTex);
    this.platform.uploadScene(input, width, height);

    let readTex: WebGLTexture = this.originalTex;
    for (let i = 0; i < passes.length; i++) {
      const last = i === passes.length - 1;
      const fbo = last ? null : (this.pingFbo[i % 2] as WebGLFramebuffer);
      const pass = passes[i] as EffectPass;
      if (!this.drawPass(pass, readTex, fbo, width, height)) return null;
      if (!last) readTex = this.pingTex[i % 2] as WebGLTexture;
    }
    return this.platform.result(width, height);
  }

  renderSource(pass: EffectPass, width: number, height: number): CanvasImageSource | null {
    this.platform.resize(width, height);
    if (!this.drawPass(pass, null, null, width, height)) return null;
    return this.platform.result(width, height);
  }

  dispose(): void {
    const gl = this.gl;
    for (const e of this.programs.values()) gl.deleteProgram(e.program);
    this.programs.clear();
    gl.deleteTexture(this.originalTex);
    gl.deleteTexture(this.pingTex[0] as WebGLTexture);
    gl.deleteTexture(this.pingTex[1] as WebGLTexture);
    gl.deleteFramebuffer(this.pingFbo[0] as WebGLFramebuffer);
    gl.deleteFramebuffer(this.pingFbo[1] as WebGLFramebuffer);
    setEffectRuntime(null);
  }
}

let platformFactory: (() => EffectGlPlatform | null) | null = null;
let installed: EffectRuntime | null | undefined;

/**
 * Override how the shared runtime's GL platform is created — used by server
 * renderers to inject a headless-gl backend (mirrors transitions'
 * `setCompositorFactory`). Clears the memoized runtime.
 */
export function setEffectPlatformFactory(create: (() => EffectGlPlatform | null) | null): void {
  platformFactory = create;
  installed = undefined;
}

/** Lazily build the shared runtime and register it with @smoove/core. Called by every Effect/ShaderSource constructor. */
export function ensureEffectRuntime(): void {
  if (installed !== undefined) return;
  const platform = platformFactory ? platformFactory() : createBrowserPlatform();
  installed = platform ? new EffectRuntime(platform) : null;
  if (installed) setEffectRuntime(installed);
}
