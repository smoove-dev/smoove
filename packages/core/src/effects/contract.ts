import type Konva from "konva";

/** A GL uniform value: float, bool, vecN (`number[]`), or an array of vecNs (`number[][]`, e.g. `vec4 u_colors[8]`). */
export type UniformValue = number | boolean | number[] | number[][];
export type EffectUniforms = Record<string, UniformValue>;

/** One fragment-shader pass. `fragment` doubles as the runtime's program-cache key. */
export type EffectPass = { fragment: string; uniforms: EffectUniforms };

/** Frame context handed to {@link KMEffect._kmPasses}. All time-like values derive from the composition clock — never wall clock — so server renders are pixel-identical. */
export interface EffectFrameContext {
  frame: number;
  /** `frame / fps`, seconds. */
  time: number;
  fps: number;
  /** Texture size in px (stage size for node effects, device px for layer effects). */
  width: number;
  height: number;
  pixelRatio: number;
}

/**
 * The open contract that lets core apply a shader effect without knowing GL.
 * Implemented by `@smoove/effects`' `Effect` base class; anything implementing
 * it can be handed to a node's `effects: [...]` config.
 */
export interface KMEffect {
  readonly _kmEffect: true;
  enabled(): boolean;
  /** The shader passes this effect contributes this frame (a blur is two). */
  _kmPasses(ctx: EffectFrameContext): EffectPass[];
  /** Bookkeeping so param setters can `batchDraw()` owning layers. */
  _kmAttach(node: Konva.Node): void;
  _kmDetach(node: Konva.Node): void;
  /**
   * Capture space for node-level application. `"node"` (default when absent)
   * captures the node's bounding box plus {@link _kmPadding}; `"stage"` keeps
   * the full-stage capture (frame effects like vignette whose uv space is the
   * whole scene). A chain with any stage-space effect runs entirely in stage
   * space.
   */
  readonly _kmSpace?: "node" | "stage";
  /**
   * How many px (stage units) the effect bleeds outside the node's bounding
   * box (blur/glow → radius). Used to inflate the node-space capture region.
   */
  _kmPadding?(ctx: EffectFrameContext): number;
}

export function isKMEffect(v: unknown): v is KMEffect {
  return typeof v === "object" && v !== null && (v as Partial<KMEffect>)._kmEffect === true;
}

/** Convenience for wrapper config types. */
export type WithEffects<T> = T & { effects?: KMEffect[] };

/**
 * A chain/source result: the image to draw plus the source-rect origin inside
 * it. The runtime may hand back a canvas larger than the requested size (kept
 * at max size to avoid per-frame drawing-buffer reallocation), so callers must
 * blit with the 9-arg `drawImage` using `(sx, sy, width, height)`.
 */
export type EffectChainResult = {
  image: CanvasImageSource;
  sx: number;
  sy: number;
};

/** Per-call options for {@link KMEffectRuntime.applyChain}. */
export type EffectApplyOptions = {
  /**
   * Identity for the uploaded input texture (typically the Konva node). When
   * provided together with `contentVersion`, the runtime keeps one GL texture
   * per key and skips the upload while the version and size are unchanged.
   */
  cacheKey?: object;
  /** Monotonic version of the captured content (see core's dirty tracking). */
  contentVersion?: number;
};

/**
 * The GL executor injected by `@smoove/effects` (browser WebGL2) or a server
 * renderer (headless-gl). Core never touches GL itself.
 */
export interface KMEffectRuntime {
  /**
   * Run `passes` over `input` (uploaded once; also bound as `u_original` for
   * composite passes). Returns an image to draw immediately (reused across
   * calls), or `null` on failure (compile error, context lost).
   *
   * `input` may be a thunk: it is only invoked when the runtime actually needs
   * to (re)upload — with `cacheKey`/`contentVersion` set and an unchanged
   * version, the capture itself is skipped along with the upload.
   */
  applyChain(
    input: CanvasImageSource | (() => CanvasImageSource),
    passes: EffectPass[],
    width: number,
    height: number,
    opts?: EffectApplyOptions,
  ): EffectChainResult | null;
  /** Render a generative pass with no input texture (ShaderSource nodes). */
  renderSource(pass: EffectPass, width: number, height: number): EffectChainResult | null;
  /** Drop the cached input texture for `cacheKey` (node detached/destroyed). */
  releaseInput?(cacheKey: object): void;
  dispose(): void;
}

let runtime: KMEffectRuntime | null = null;

/** Called by `@smoove/effects` (auto, on first effect construction) or tests. */
export function setEffectRuntime(r: KMEffectRuntime | null): void {
  runtime = r;
}

export function getEffectRuntime(): KMEffectRuntime | null {
  return runtime;
}
