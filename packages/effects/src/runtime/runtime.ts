import {
  type EffectApplyOptions,
  type EffectChainResult,
  type EffectPass,
  type KMEffectRuntime,
  setEffectRuntime,
  type UniformValue,
} from "@smoove/core";
import { createBrowserPlatform, type EffectGlPlatform } from "./platform.js";
import { createProgram, createTexture, type GlContext } from "./shared.js";

type ProgramEntry = {
  program: WebGLProgram;
  aPos: number;
  locations: Map<string, WebGLUniformLocation | null>;
};

type FboEntry = {
  tex: [WebGLTexture, WebGLTexture];
  fbo: [WebGLFramebuffer, WebGLFramebuffer];
  /** LRU tick of last use. */
  at: number;
};

type InputEntry = { tex: WebGLTexture; width: number; height: number; version: number };

/** Distinct ping-pong FBO sizes kept alive (mixed comps use a handful; evict LRU past this). */
const MAX_FBO_SIZES = 8;

export class EffectRuntime implements KMEffectRuntime {
  /** True on a WebGL2 context (browser); false on WebGL1 (headless-gl). Some heavy sources require WebGL2. */
  readonly webgl2: boolean;
  private readonly platform: EffectGlPlatform;
  private readonly gl: GlContext;
  private readonly programs = new Map<string, ProgramEntry>();
  /** Ping-pong FBO/texture pairs per exact size — sized to the chain's region so uv spans the content. */
  private readonly fbos = new Map<string, FboEntry>();
  private fboTick = 0;
  /** Fallback input texture for chains without a cache key. */
  private readonly sharedInputTex: WebGLTexture;
  /** Cached input textures per node (content-version keyed uploads). */
  private readonly inputs = new WeakMap<object, InputEntry>();
  /** Live input textures, for dispose() — WeakMap isn't iterable. */
  private readonly liveInputTextures = new Set<WebGLTexture>();
  /** Deletes a node's GL texture once the node itself is collected. */
  private readonly reclaim = new FinalizationRegistry<WebGLTexture>((tex) => {
    if (this.liveInputTextures.delete(tex)) this.gl.deleteTexture(tex);
  });
  /** Reused flat buffers for vecN[] uniforms, keyed by length. */
  private readonly flatPool = new Map<number, Float32Array>();
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
    this.sharedInputTex = createTexture(gl);
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
        e = { program, aPos: this.gl.getAttribLocation(program, "a_pos"), locations: new Map() };
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
      const len = vecs.length * size;
      let flat = this.flatPool.get(len);
      if (!flat) {
        flat = new Float32Array(len);
        this.flatPool.set(len, flat);
      }
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

  /** Ping-pong FBO pair for this exact size (uv semantics need texture == region size). */
  private fboEntry(width: number, height: number): FboEntry {
    const gl = this.gl;
    const key = `${width}x${height}`;
    let e = this.fbos.get(key);
    if (!e) {
      const tex: [WebGLTexture, WebGLTexture] = [createTexture(gl), createTexture(gl)];
      const f0 = gl.createFramebuffer();
      const f1 = gl.createFramebuffer();
      if (!f0 || !f1) throw new Error("effects: failed to create framebuffers");
      const fbo: [WebGLFramebuffer, WebGLFramebuffer] = [f0, f1];
      for (let i = 0; i < 2; i++) {
        gl.bindTexture(gl.TEXTURE_2D, tex[i] as WebGLTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i] as WebGLFramebuffer);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          tex[i] as WebGLTexture,
          0,
        );
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      e = { tex, fbo, at: 0 };
      this.fbos.set(key, e);
      if (this.fbos.size > MAX_FBO_SIZES) this.evictFbo();
    }
    e.at = ++this.fboTick;
    return e;
  }

  private evictFbo(): void {
    let oldestKey: string | null = null;
    let oldest = Number.POSITIVE_INFINITY;
    for (const [key, e] of this.fbos) {
      if (e.at < oldest) {
        oldest = e.at;
        oldestKey = key;
      }
    }
    if (oldestKey === null) return;
    const e = this.fbos.get(oldestKey) as FboEntry;
    this.gl.deleteTexture(e.tex[0]);
    this.gl.deleteTexture(e.tex[1]);
    this.gl.deleteFramebuffer(e.fbo[0]);
    this.gl.deleteFramebuffer(e.fbo[1]);
    this.fbos.delete(oldestKey);
  }

  /** Resolve (and upload if needed) the chain's input texture. */
  private inputTexture(
    input: CanvasImageSource | (() => CanvasImageSource),
    width: number,
    height: number,
    opts?: EffectApplyOptions,
  ): WebGLTexture {
    const gl = this.gl;
    const key = opts?.cacheKey;
    const version = opts?.contentVersion;
    if (key !== undefined && version !== undefined) {
      let e = this.inputs.get(key);
      if (!e) {
        const tex = createTexture(gl);
        this.liveInputTextures.add(tex);
        this.reclaim.register(key, tex, tex);
        e = { tex, width: 0, height: 0, version: -1 };
        this.inputs.set(key, e);
      }
      const fresh = e.width === width && e.height === height && e.version === version;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, e.tex);
      if (!fresh) {
        const source = typeof input === "function" ? input() : input;
        this.platform.uploadScene(source, width, height);
        e.width = width;
        e.height = height;
        e.version = version;
      }
      return e.tex;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sharedInputTex);
    const source = typeof input === "function" ? input() : input;
    this.platform.uploadScene(source, width, height);
    return this.sharedInputTex;
  }

  private drawPass(
    pass: EffectPass,
    readTex: WebGLTexture | null,
    originalTex: WebGLTexture | null,
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
    gl.enableVertexAttribArray(e.aPos);
    gl.vertexAttribPointer(e.aPos, 2, gl.FLOAT, false, 0, 0);
    if (readTex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readTex);
      const t = this.loc(e, "u_texture");
      if (t) gl.uniform1i(t, 0);
    }
    if (originalTex) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, originalTex);
      const o = this.loc(e, "u_original");
      if (o) gl.uniform1i(o, 1);
    }
    this.setUniform(e, "u_resolution", [width, height]);
    // Flip only when rendering to the visible framebuffer (see shared.ts) —
    // and not even then when the platform reads pixels back (bottom-up
    // readPixels of an un-flipped pass is already top-down).
    const flip = toFbo === null && (this.platform.flipFinalPass ?? true);
    this.setUniform(e, "u_flipY", flip ? 1 : 0);
    for (const name in pass.uniforms) {
      this.setUniform(e, name, pass.uniforms[name] as UniformValue);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }

  applyChain(
    input: CanvasImageSource | (() => CanvasImageSource),
    passes: EffectPass[],
    width: number,
    height: number,
    opts?: EffectApplyOptions,
  ): EffectChainResult | null {
    if (passes.length === 0) return null;
    this.platform.resize(width, height);
    const inputTex = this.inputTexture(input, width, height, opts);
    const pingpong = passes.length > 1 ? this.fboEntry(width, height) : null;

    let readTex: WebGLTexture = inputTex;
    for (let i = 0; i < passes.length; i++) {
      const last = i === passes.length - 1;
      const fbo = last ? null : ((pingpong as FboEntry).fbo[i % 2] as WebGLFramebuffer);
      const pass = passes[i] as EffectPass;
      if (!this.drawPass(pass, readTex, inputTex, fbo, width, height)) return null;
      if (!last) readTex = (pingpong as FboEntry).tex[i % 2] as WebGLTexture;
    }
    return this.platform.result(width, height);
  }

  renderSource(pass: EffectPass, width: number, height: number): EffectChainResult | null {
    this.platform.resize(width, height);
    if (!this.drawPass(pass, null, null, null, width, height)) return null;
    return this.platform.result(width, height);
  }

  releaseInput(cacheKey: object): void {
    const e = this.inputs.get(cacheKey);
    if (!e) return;
    this.inputs.delete(cacheKey);
    this.reclaim.unregister(e.tex);
    if (this.liveInputTextures.delete(e.tex)) this.gl.deleteTexture(e.tex);
  }

  dispose(): void {
    const gl = this.gl;
    for (const e of this.programs.values()) gl.deleteProgram(e.program);
    this.programs.clear();
    gl.deleteTexture(this.sharedInputTex);
    for (const tex of this.liveInputTextures) gl.deleteTexture(tex);
    this.liveInputTextures.clear();
    for (const e of this.fbos.values()) {
      gl.deleteTexture(e.tex[0]);
      gl.deleteTexture(e.tex[1]);
      gl.deleteFramebuffer(e.fbo[0]);
      gl.deleteFramebuffer(e.fbo[1]);
    }
    this.fbos.clear();
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
