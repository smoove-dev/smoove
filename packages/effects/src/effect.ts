import type { EffectFrameContext, EffectPass, KMEffect } from "@smoove/core";
import type Konva from "konva";
import {
  buildAccessors,
  defaultsFromSchema,
  type ParamSchema,
  paramsToUniforms,
  pickSchemaConfig,
} from "./params.js";
import { ensureEffectRuntime } from "./runtime/runtime.js";

export type EffectConfig = { enabled?: boolean } & Record<string, unknown>;

/**
 * Base class for all shader filter effects. Subclasses supply a param schema
 * and a fragment shader; accessors (`blur.radius(8)`) are generated from the
 * schema. Instances are plain objects, shareable across nodes.
 */
export abstract class Effect implements KMEffect {
  readonly _kmEffect = true as const;
  /** Exposed for the Studio props panel. */
  readonly schema: ParamSchema;
  protected readonly _values: Record<string, unknown>;
  private readonly _fragment: string;
  private _enabled: boolean;
  private readonly _nodes = new Set<Konva.Node>();

  protected constructor(schema: ParamSchema, fragment: string, config: EffectConfig = {}) {
    ensureEffectRuntime();
    this.schema = schema;
    this._fragment = fragment;
    this._values = { ...defaultsFromSchema(schema), ...pickSchemaConfig(schema, config) };
    this._enabled = config.enabled ?? true;
    buildAccessors(this, schema);
  }

  enable(on = true): this {
    if (on !== this._enabled) {
      this._enabled = on;
      this._redraw();
    }
    return this;
  }

  enabled(): boolean {
    return this._enabled;
  }

  /** Bulk param update: `e.set({ radius: 4, color: "#f00" })`. Unknown keys ignored. */
  set(values: Record<string, unknown>): this {
    let changed = false;
    for (const [key, v] of Object.entries(pickSchemaConfig(this.schema, values))) {
      if (this._values[key] !== v) {
        this._values[key] = v;
        changed = true;
      }
    }
    if (changed) this._redraw();
    return this;
  }

  /** @internal accessor plumbing (see buildAccessors). */
  _kmParamGet(key: string): unknown {
    return this._values[key];
  }

  /** @internal */
  _kmParamSet(key: string, v: unknown): this {
    if (this._values[key] !== v) {
      this._values[key] = v;
      this._redraw();
    }
    return this;
  }

  private _redraw(): void {
    for (const node of this._nodes) node.getLayer()?.batchDraw();
  }

  _kmAttach(node: Konva.Node): void {
    this._nodes.add(node);
  }

  _kmDetach(node: Konva.Node): void {
    this._nodes.delete(node);
  }

  _kmPasses(ctx: EffectFrameContext): EffectPass[] {
    return [
      { fragment: this._fragment, uniforms: paramsToUniforms(this.schema, this._values, ctx) },
    ];
  }
}
