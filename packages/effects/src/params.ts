import type Konva from "konva";

/** A node an effect can ask to rebuild its cached output. */
type Invalidatable = Konva.Node & { _fxInvalidate?: () => void };

/** Bounds and default for one scalar parameter. */
export type ParamSpec = {
  default: number;
  min?: number;
  max?: number;
  /**
   * `true` when the value is a length in CSS px, so uniform assembly scales it
   * by `pixelRatio` and a 1x preview matches a 2x render.
   */
  px?: boolean;
};

export type ParamSpecs = Record<string, ParamSpec>;

function clamp(value: number, spec: ParamSpec, label: string, name: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label}: ${name} must be a finite number, got ${value}`);
  }
  if (spec.min !== undefined && value < spec.min) return spec.min;
  if (spec.max !== undefined && value > spec.max) return spec.max;
  return value;
}

/**
 * Check an `[r, g, b]` colour option and return a fresh tuple.
 *
 * A colour is not a clamping scalar — a wrong-shaped array is a mistake, not an
 * overshoot — so this throws rather than coercing.
 */
export function validateColor(
  label: string,
  name: string,
  color: [number, number, number],
): [number, number, number] {
  if (!Array.isArray(color) || color.length !== 3 || !color.every((c) => Number.isFinite(c))) {
    throw new Error(`${label}: ${name} must be three finite numbers in 0..1`);
  }
  return [color[0], color[1], color[2]];
}

/** A colour an effect will compare against real pixels: `#rgb`, `#rrggbb`, or 0..1 triplet. */
export type ColorInput = string | [number, number, number];

/**
 * Accept a hex colour as well as an `[r, g, b]` triplet.
 *
 * Only for the colour a user has to *match* rather than choose — a chroma key's
 * screen colour comes off an eyedropper as `#3ea346`, and making that a triplet
 * by hand is transcription work with a wrong answer at the end of it.
 */
export function parseColor(
  label: string,
  name: string,
  color: ColorInput,
): [number, number, number] {
  if (typeof color !== "string") return validateColor(label, name, color);
  const hex = color.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(
      `${label}: ${name} must be a hex colour like "#3ea346" or three numbers in 0..1`,
    );
  }
  const byte = (at: number) => Number.parseInt(full.slice(at, at + 2), 16) / 255;
  return [byte(0), byte(2), byte(4)];
}

/**
 * Tracks which nodes an effect is attached to, so setting a parameter can
 * invalidate their cached output.
 */
export class Attachments {
  private readonly nodes = new Set<Invalidatable>();

  attach(node: Konva.Node): void {
    this.nodes.add(node as Invalidatable);
  }

  detach(node: Konva.Node): void {
    this.nodes.delete(node as Invalidatable);
  }

  invalidate(): void {
    for (const node of this.nodes) node._fxInvalidate?.();
  }
}

/**
 * Install `specs` as clamping accessor properties on `target`.
 *
 * Values are clamped on construction *and* on assignment, because the common
 * way to animate a param is `fx.intensity = interpolate(...)` and an easing
 * overshoot must not reach the shader as an out-of-range uniform.
 */
export function defineParams<T extends object>(
  target: T,
  specs: ParamSpecs,
  overrides: Partial<Record<string, number>>,
  attachments: Attachments,
  label: string,
): void {
  for (const [name, spec] of Object.entries(specs)) {
    const initial = overrides[name];
    let value = clamp(initial ?? spec.default, spec, label, name);
    Object.defineProperty(target, name, {
      enumerable: true,
      get: () => value,
      set: (next: number) => {
        value = clamp(next, spec, label, name);
        attachments.invalidate();
      },
    });
  }
}

/**
 * Build the uniform map for `specs`, prefixing names with `u_` and scaling
 * px-valued params into device px.
 */
export function paramUniforms(
  source: Record<string, number>,
  specs: ParamSpecs,
  pixelRatio: number,
): Record<string, number> {
  const uniforms: Record<string, number> = {};
  for (const [name, spec] of Object.entries(specs)) {
    const value = source[name] as number;
    uniforms[`u_${name}`] = spec.px ? value * pixelRatio : value;
  }
  return uniforms;
}
