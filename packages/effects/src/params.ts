import type { EffectFrameContext, EffectUniforms, UniformValue } from "@smoove/core";

export type ParamType = "number" | "boolean" | "color" | "colors" | "vec2" | "enum";

export type ParamSpec = {
  type: ParamType;
  /** GLSL uniform name, or `null` for params consumed in TS (e.g. `speed`). */
  uniform: string | null;
  default: unknown;
  min?: number;
  max?: number; // for "colors": max stop count (GLSL array size)
  step?: number;
  /** "deg" numbers are converted to radians at uniform time. */
  unit?: "deg";
  /** enum only: ordered labels; uniform value is the index as float. */
  values?: string[];
  /** enum only: explicit label → uniform value map (for non-0-based enums). */
  valueMap?: Record<string, number>;
};

/** Schema drives accessor generation now and the Studio props panel later. */
export type ParamSchema = Record<string, ParamSpec>;

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  transparent: "#00000000",
};

/** Parse `#rgb/#rrggbb/#rrggbbaa/rgb()/rgba()` (+ a few names) to a 0..1 vec4. */
export function parseColorVec4(input: string): number[] {
  let c = input.trim().toLowerCase();
  c = NAMED[c] ?? c;
  const fn = c.match(/^rgba?\(([^)]+)\)$/);
  if (fn?.[1]) {
    const parts = fn[1].split(",").map((p) => Number.parseFloat(p));
    return [
      (parts[0] ?? 0) / 255,
      (parts[1] ?? 0) / 255,
      (parts[2] ?? 0) / 255,
      parts.length > 3 ? (parts[3] ?? 1) : 1,
    ];
  }
  let hex = c.startsWith("#") ? c.slice(1) : c;
  if (hex.length === 3 || hex.length === 4) {
    hex = [...hex].map((ch) => ch + ch).join("");
  }
  const n = Number.parseInt(hex.padEnd(8, "f"), 16);
  return [
    ((n >>> 24) & 0xff) / 255,
    ((n >>> 16) & 0xff) / 255,
    ((n >>> 8) & 0xff) / 255,
    (n & 0xff) / 255,
  ];
}

export function defaultsFromSchema(schema: ParamSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(schema)) out[key] = spec.default;
  return out;
}

export function pickSchemaConfig(
  schema: ParamSchema,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(schema)) {
    if (config[key] !== undefined) out[key] = config[key];
  }
  return out;
}

/**
 * Map param values → GLSL uniforms per the schema, plus the shared `u_time`
 * (composition seconds × `speed` param when present — deterministic).
 */
export function paramsToUniforms(
  schema: ParamSchema,
  values: Record<string, unknown>,
  ctx: EffectFrameContext,
): EffectUniforms {
  const out: EffectUniforms = {};
  for (const [key, spec] of Object.entries(schema)) {
    if (spec.uniform === null) continue;
    const v = values[key];
    let mapped: UniformValue;
    switch (spec.type) {
      case "number":
        mapped = spec.unit === "deg" ? ((v as number) * Math.PI) / 180 : (v as number);
        break;
      case "boolean":
        mapped = v as boolean;
        break;
      case "color":
        mapped = parseColorVec4(v as string);
        break;
      case "colors": {
        const list = (v as string[]).slice(0, spec.max ?? 8).map(parseColorVec4);
        out[`${spec.uniform}Count`] = list.length;
        mapped = list;
        break;
      }
      case "vec2":
        mapped = v as number[];
        break;
      case "enum":
        mapped = spec.valueMap
          ? (spec.valueMap[v as string] ?? 0)
          : Math.max(0, (spec.values ?? []).indexOf(v as string));
        break;
    }
    out[spec.uniform] = mapped;
  }
  const speed = typeof values.speed === "number" ? values.speed : 1;
  out.u_time = ctx.time * speed;
  return out;
}

/** Define a Konva-Factory-style `key(v?)` accessor per schema param. */
export function buildAccessors(
  target: { _kmParamGet(key: string): unknown; _kmParamSet(key: string, v: unknown): unknown },
  schema: ParamSchema,
): void {
  for (const key of Object.keys(schema)) {
    Object.defineProperty(target, key, {
      value: function (this: typeof target, v?: unknown) {
        if (v === undefined) return this._kmParamGet(key);
        return this._kmParamSet(key, v);
      },
      writable: true,
      configurable: true,
    });
  }
}
