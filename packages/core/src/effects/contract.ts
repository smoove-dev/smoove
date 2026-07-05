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
}

export function isKMEffect(v: unknown): v is KMEffect {
  return typeof v === "object" && v !== null && (v as Partial<KMEffect>)._kmEffect === true;
}

/** Convenience for wrapper config types. */
export type WithEffects<T> = T & { effects?: KMEffect[] };

/**
 * The GL executor injected by `@smoove/effects` (browser WebGL2) or a server
 * renderer (headless-gl). Core never touches GL itself.
 */
export interface KMEffectRuntime {
  /**
   * Run `passes` over `input` (uploaded once; also bound as `u_original` for
   * composite passes). Returns an image to draw immediately (reused across
   * calls), or `null` on failure (compile error, context lost).
   */
  applyChain(
    input: CanvasImageSource,
    passes: EffectPass[],
    width: number,
    height: number,
  ): CanvasImageSource | null;
  /** Render a generative pass with no input texture (ShaderSource nodes). */
  renderSource(pass: EffectPass, width: number, height: number): CanvasImageSource | null;
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
