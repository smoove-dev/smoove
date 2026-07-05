import {
  type EffectFrameContext,
  type EffectPass,
  FlexShape,
  getComposition,
  getEffectRuntime,
  type KMEffectRuntime,
  type LeafConfig,
} from "@smoove/core";
import Konva from "konva";
import {
  buildAccessors,
  defaultsFromSchema,
  type ParamSchema,
  paramsToUniforms,
  pickSchemaConfig,
} from "./params.js";
import { ensureEffectRuntime } from "./runtime/runtime.js";

export type ShaderSourceConfig = LeafConfig & { speed?: number };

/**
 * Base for generative shader nodes (MeshGradient, Metaballs, ...): a flex-aware
 * Konva shape whose pixels come from a fragment shader with no input texture.
 * Sized by layout (or explicit width/height); animated from the composition
 * clock; can itself take `effects: [...]` like any node.
 */
export abstract class ShaderSource extends FlexShape<Konva.Shape, ShaderSourceConfig>(Konva.Shape) {
  /** Exposed for the Studio props panel. */
  readonly schema: ParamSchema;
  /** Subclasses set this when their fragment breaks WebGL1 compilers (e.g. crashes headless-gl). */
  protected _requiresWebGL2 = false;
  protected readonly _values: Record<string, unknown>;
  private readonly _fragment: string;

  protected constructor(
    schema: ParamSchema,
    fragment: string,
    config: Record<string, unknown> = {},
  ) {
    super(config as ShaderSourceConfig);
    ensureEffectRuntime();
    this.schema = schema;
    this._fragment = fragment;
    this._values = { ...defaultsFromSchema(schema), ...pickSchemaConfig(schema, config) };
    buildAccessors(this, schema);
    this.sceneFunc((ctx) => this._drawShader(ctx));
  }

  /** @internal accessor plumbing (see buildAccessors). */
  _kmParamGet(key: string): unknown {
    return this._values[key];
  }

  /** @internal */
  _kmParamSet(key: string, v: unknown): this {
    if (this._values[key] !== v) {
      this._values[key] = v;
      this.getLayer()?.batchDraw();
    }
    return this;
  }

  /**
   * Produce this frame's pixels. The default source has no input texture;
   * image-driven subclasses override to run the pass over a processed image.
   */
  protected _render(
    runtime: KMEffectRuntime,
    pass: EffectPass,
    width: number,
    height: number,
  ): CanvasImageSource | null {
    return runtime.renderSource(pass, width, height);
  }

  private _drawShader(ctx: Konva.Context): void {
    const runtime = getEffectRuntime();
    if (!runtime) return;
    if (this._requiresWebGL2 && !(runtime as { webgl2?: boolean }).webgl2) return;
    const w = Math.max(1, Math.round(this.width()));
    const h = Math.max(1, Math.round(this.height()));
    const stage = this.getStage();
    const comp = stage ? getComposition(stage) : null;
    const frame = comp ? comp.frame.get() : 0;
    const fps = comp ? comp.fps : 30;
    const fctx: EffectFrameContext = {
      frame,
      time: frame / fps,
      fps,
      width: w,
      height: h,
      pixelRatio: 1,
    };
    const pass: EffectPass = {
      fragment: this._fragment,
      uniforms: {
        // Neutral values for upstream sizing uniforms (fit system removed):
        // only bound where a vendored fragment declares them.
        u_pixelRatio: 1,
        u_scale: 1,
        u_fit: 0,
        u_rotation: 0,
        u_offsetX: 0,
        u_offsetY: 0,
        u_originX: 0.5,
        u_originY: 0.5,
        u_worldWidth: 0,
        u_worldHeight: 0,
        ...paramsToUniforms(this.schema, this._values, fctx),
      },
    };
    const out = this._render(runtime, pass, w, h);
    if (out) ctx.drawImage(out, 0, 0, w, h);
  }
}
