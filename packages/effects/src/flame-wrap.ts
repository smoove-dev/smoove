import {
  createCpuCanvas,
  type EffectFrameContext,
  type EffectPadding,
  type EffectPass,
  type SmooveEffect,
} from "@smoove/core";
import { FLAME_WRAP_FRAG, FLAME_WRAP_SILHOUETTE_FRAG } from "./glsl/flame-wrap.frag.js";
import {
  Attachments,
  defineParams,
  type ParamSpecs,
  paramUniforms,
  validateColor,
} from "./params.js";
import { sdfFor } from "./sdf.js";

/**
 * Every flameWrap parameter, with its bounds and whether it is a CSS-px length.
 *
 * Defaults are the reference effect's, unchanged, so `flameWrap()` with no
 * arguments gives the picture the reference gives — including its blue burn.
 */
const SPECS: ParamSpecs = {
  intensity: { default: 0.5, min: 0, max: 3 },
  height: { default: 170, min: 0, px: true },
  spread: { default: 8, min: 0, px: true },
  radius: { default: 40, min: 0, px: true },
  speed: { default: 0.25, min: 0, max: 10 },
  scale: { default: 0.75, min: 0, max: 1 },
  turbulence: { default: 0.5, min: 0, max: 1 },
  turbulenceScale: { default: 0.5, min: 0.2, max: 3 },
  turbulenceReach: { default: 25, min: 0, px: true },
  sparks: { default: 1.5, min: 0, max: 3 },
  sparkSize: { default: 0.35, min: 0.2, max: 3 },
  sparkDensity: { default: 1, min: 0.3, max: 2.5 },
  sparkSpeed: { default: 1, min: 0.1, max: 3 },
  rim: { default: 2.5, min: 0, max: 3 },
  melt: { default: 4.5, min: 0, px: true },
  distortion: { default: 10, min: 0, px: true },
  smoke: { default: 1.5, min: 0, max: 2 },
  ember: { default: 2, min: 0, max: 2 },
  scorch: { default: 0, min: 0, max: 2 },
};

type ScalarParams = {
  /** Overall brightness of the fire (0 to 3). */
  intensity: number;
  /** Reach of the flames above the top edge, CSS px. */
  height: number;
  /** Reach of the glow on the sides and bottom, CSS px. */
  spread: number;
  /** Corner radius of the burning outline, CSS px. Match your content. */
  radius: number;
  /** Animation speed multiplier for the whole effect. */
  speed: number;
  /** Flame detail from 0 (broad licks) to 1 (fine licks). */
  scale: number;
  /** Amplitude of the turbulence waves shaping the flames (0 to 1). */
  turbulence: number;
  /** Frequency multiplier of the turbulence waves (0.2 to 3). */
  turbulenceScale: number;
  /** How far from the edges the heat warps the content, CSS px. */
  turbulenceReach: number;
  /** Brightness of the spark highlights (0 to 3). 0 disables them. */
  sparks: number;
  /** Size multiplier for individual sparks (0.2 to 3). */
  sparkSize: number;
  /** How many sparks fly at once (0.3 to 2.5). */
  sparkDensity: number;
  /** How fast sparks rise and flicker (0.1 to 3). */
  sparkSpeed: number;
  /** Strength of the molten glow hugging the edges (0 to 3). */
  rim: number;
  /** How far the flames eat into the content silhouette, CSS px. */
  melt: number;
  /** Heat shimmer displacement of the content near the edges, CSS px. */
  distortion: number;
  /** Amount of smoke drifting off the flames (0 to 2). */
  smoke: number;
  /** Brightness of the glowing ember line on the burnt edges (0 to 2). */
  ember: number;
  /** Darkness of the charred band on the content edges (0 to 2). */
  scorch: number;
};

/**
 * What the fire wraps.
 *
 * - `box` — the node's rounded bounding box, shaped by `radius`. One shader
 *   pass, nothing derived from the pixels, and the right answer for a card.
 * - `silhouette` — the node's own alpha edge, so a burning `Text` burns letter
 *   by letter and a burning icon burns around its strokes. Costs a distance
 *   field, rebuilt whenever the node's content changes, and ignores `radius`.
 */
export type FlameWrapShape = "box" | "silhouette";

export type FlameWrapOptions = Partial<ScalarParams> & {
  /** Flame colour as `[r, g, b]` in 0..1. Defaults to the reference's blue. */
  color?: [number, number, number];
  /** Whether the flames follow the node's box or its alpha. Default `box`. */
  shape?: FlameWrapShape;
};

/** A live flameWrap instance: mutate a param to animate it. */
export type FlameWrap = SmooveEffect &
  ScalarParams & {
    color: [number, number, number];
    shape: FlameWrapShape;
  };

/**
 * Animated fire wrapping a node's rounded box, with heat distortion, sparks, a
 * molten rim, smoke and scorching.
 *
 * One single-pass fragment shader over the captured node. The flames follow an
 * analytic rounded rectangle — the node's own bounding box, with `radius` to
 * match its corners — while the content inside burns back, chars and glows at
 * the burn line. Time enters only as `u_time` from the frame clock, so the
 * effect is frame-pure: seeking to frame 900 gives the same pixels as playing
 * to it.
 *
 * The burn is ambient and looping; `intensity` is the knob to animate for an
 * ignition. Requires a WebGL platform: without one the pass is skipped, the node
 * draws undistorted, and a warning is logged once.
 *
 * ```ts
 * const fire = flameWrap({ height: 140, radius: 28 });
 * card.effects([fire]);
 * seq.register((frame) => {
 *   fire.intensity = interpolate(frame, [0, 20], [0, 1]);
 * });
 * ```
 */
export function flameWrap(options: FlameWrapOptions = {}): FlameWrap {
  const { color = [0.31, 0.54, 1], shape = "box", ...scalars } = options;
  if (shape !== "box" && shape !== "silhouette") {
    throw new Error(`flameWrap: shape must be "box" or "silhouette", got ${String(shape)}`);
  }
  const attachments = new Attachments();
  let tint = validateColor("flameWrap", "color", color);
  let outline: FlameWrapShape = shape;

  const effect = {
    _fxEffect: true as const,

    get color(): [number, number, number] {
      return tint;
    },
    set color(next: [number, number, number]) {
      tint = validateColor("flameWrap", "color", next);
      attachments.invalidate();
    },

    get shape(): FlameWrapShape {
      return outline;
    },
    set shape(next: FlameWrapShape) {
      outline = next;
      attachments.invalidate();
    },

    enabled(): boolean {
      return (effect as unknown as ScalarParams).intensity > 0;
    },

    /**
     * Fire climbs `height` above the top edge but only glows `spread` to the
     * sides, so the padding is asymmetric — a symmetric box would shade several
     * times the necessary pixels every frame, and region area is this effect's
     * dominant cost.
     *
     * Top gets a quarter more than `height` because the flame band ends around
     * 0.86 of it and sparks ride past that; the sides get three times `spread`
     * because that is where the halo has decayed to nothing.
     */
    padding(fc: EffectFrameContext): EffectPadding {
      const params = effect as unknown as ScalarParams;
      const unit = Math.max(params.height, 24);
      const sides = (Math.max(params.spread, 8) * 3 + params.melt + 6) * fc.pixelRatio;
      return {
        top: (unit * 1.25 + params.melt) * fc.pixelRatio,
        right: sides,
        bottom: sides,
        left: sides,
      };
    },

    passes(fc: EffectFrameContext): EffectPass[] {
      const params = effect as unknown as Record<string, number>;
      const box = fc.contentRect;
      const silhouette = outline === "silhouette";
      return [
        {
          kind: "shader",
          fragment: silhouette ? FLAME_WRAP_SILHOUETTE_FRAG : FLAME_WRAP_FRAG,
          // The silhouette variant reads the node's alpha edge from a distance
          // field, cached against contentVersion so it is built once per change
          // rather than once per frame.
          textures: silhouette
            ? (context, source) => [
                sdfFor(
                  context.node,
                  source,
                  context.width,
                  context.height,
                  context.contentVersion,
                  // CPU-pinned: building the field reads pixels back, and skia's
                  // GPU rasterizer corrupts under readback.
                  () => createCpuCanvas(context.width, context.height),
                ),
              ]
            : undefined,
          uniforms: {
            ...paramUniforms(params, SPECS, fc.pixelRatio),
            u_color: tint,
            u_time: fc.time,
            u_resolution: [fc.width, fc.height],
            // The node's box inside the captured region, in the shader's frame:
            // device px measured from the region's bottom-left, y growing up.
            u_rectCenter: [box.x + box.width / 2, fc.height - (box.y + box.height / 2)],
            u_rectHalf: [Math.max(box.width / 2, 1), Math.max(box.height / 2, 1)],
          },
        },
      ];
    },

    attach(node: Parameters<SmooveEffect["attach"]>[0]): void {
      attachments.attach(node);
    },

    detach(node: Parameters<SmooveEffect["detach"]>[0]): void {
      attachments.detach(node);
    },
  };

  defineParams(effect, SPECS, scalars as Record<string, number>, attachments, "flameWrap");
  return effect as unknown as FlameWrap;
}
