import type { EffectFrameContext, EffectPass, SmooveEffect } from "@smoove/core";
import { DROPLETS_FRAG } from "./glsl/droplets.frag.js";
import {
  Attachments,
  defineParams,
  type ParamSpecs,
  paramUniforms,
  validateColor,
} from "./params.js";

/**
 * Every droplets parameter, with its bounds and whether it is a CSS-px length.
 *
 * Defaults are the reference effect's, with three exceptions: `blur`, a real
 * radius here rather than a mip level; `sheen`, which has no reference
 * counterpart; and `scale`, raised because drop size is measured in CSS px so
 * that a 2x render matches its preview, where the reference measured it in
 * device px and so drew denser rain on a retina screen than a plain one.
 */
const SPECS: ParamSpecs = {
  intensity: { default: 0.5, min: 0, max: 1.25 },
  speed: { default: 1, min: 0, max: 10 },
  scale: { default: 0.7, min: 0.02, max: 4 },
  dropWidth: { default: 1, min: 0.05, max: 4 },
  dropLength: { default: 1, min: 0.05, max: 4 },
  refraction: { default: 0.2, min: 0, max: 2 },
  blur: { default: 0, min: 0, max: 64, px: true },
  vignette: { default: 0, min: 0, max: 1 },
  fallSpeed: { default: 1, min: 0, max: 5 },
  wiggle: { default: 1, min: 0, max: 3 },
  staticDrops: { default: 0.2, min: 0, max: 3 },
  sheen: { default: 0.6, min: 0, max: 3 },
  tintStrength: { default: 0, min: 0, max: 1 },
};

type ScalarParams = {
  /** How much rain falls, from a light drizzle to a downpour (0 to 1.25). */
  intensity: number;
  /** Animation speed multiplier for the whole effect. */
  speed: number;
  /** Size of the droplet pattern. Higher means smaller drops (0.02 to 4). */
  scale: number;
  /** Width of the droplets and their trails (0.05 to 4). */
  dropWidth: number;
  /** How elongated the falling droplets are (0.05 to 4). */
  dropLength: number;
  /** How strongly droplets refract the content behind them (0 to 2). */
  refraction: number;
  /** Defocus of the glass outside the droplets, CSS px. A fogged window. */
  blur: number;
  /** Darkens the edges of the node (0 to 1). */
  vignette: number;
  /** How fast the running drops slide down (0 to 5). */
  fallSpeed: number;
  /** Horizontal wiggle of the running drops (0 to 3). */
  wiggle: number;
  /** Amount of fine drizzle that never runs (0 to 3). */
  staticDrops: number;
  /** How brightly the water catches the light (0 to 3). 0 leaves only refraction. */
  sheen: number;
  /** Strength of the tint layered over the content (0 to 1). */
  tintStrength: number;
};

export type DropletsOptions = Partial<ScalarParams> & {
  /** Tint colour as `[r, g, b]` in 0..1. Defaults to white. */
  tint?: [number, number, number];
};

/** A live droplets instance: mutate a param to animate it. */
export type Droplets = SmooveEffect &
  ScalarParams & {
    tint: [number, number, number];
  };

/**
 * Rain running down a pane of glass in front of a node: drops that swell, let
 * go and slide, the wet trails they leave, a fine drizzle between them, and the
 * refraction of whatever sits behind.
 *
 * One single-pass fragment shader over the captured node. The glass is exactly
 * the node's own box and everything the effect draws is gated on the node's
 * alpha, so it never paints outside what the node already covered, and it needs
 * no padding at all. Time enters only as `u_time` from the frame clock, so the
 * effect is frame-pure: seeking to frame 900 gives the same pixels as playing
 * to it.
 *
 * Refraction is invisible over a flat colour, so put this on something with
 * detail behind it — a `Video`, an `Img`, or a full-frame `Sequence`. On a
 * plain card it is `sheen` that makes the water read.
 *
 * The rain loops on its own; `intensity` is the knob to animate for a
 * downpour building or clearing. At its default 0.5 it is a steady rain.
 * Requires a WebGL platform: without one the pass is skipped, the node draws
 * undistorted, and a warning is logged once.
 *
 * ```ts
 * const rain = droplets({ intensity: 0, blur: 6 });
 * photo.effects([rain]);
 * seq.register((frame) => {
 *   rain.intensity = interpolate(frame, [0, 60], [0, 1]);
 * });
 * ```
 *
 * The reference effect wiped drops away under the pointer. That needs a trail
 * accumulated frame over frame, which a seekable timeline cannot have, so there
 * is no interaction here — animate `intensity` instead.
 */
export function droplets(options: DropletsOptions = {}): Droplets {
  const { tint = [1, 1, 1], ...scalars } = options;
  const attachments = new Attachments();
  let colour = validateColor("droplets", "tint", tint);

  const effect = {
    _fxEffect: true as const,

    get tint(): [number, number, number] {
      return colour;
    },
    set tint(next: [number, number, number]) {
      colour = validateColor("droplets", "tint", next);
      attachments.invalidate();
    },

    /**
     * Rain is not the only thing this draws: fogging and vignetting the glass
     * are looks of their own, and either is worth the pass with no rain at all.
     */
    enabled(): boolean {
      const params = effect as unknown as ScalarParams;
      return (
        params.intensity > 0 || params.blur > 0 || params.vignette > 0 || params.tintStrength > 0
      );
    },

    // No padding: the water lives on the node's own box and nothing reaches
    // past it, so the captured region is as small as it can be.

    passes(fc: EffectFrameContext): EffectPass[] {
      const params = effect as unknown as Record<string, number>;
      const box = fc.contentRect;
      // Drop size follows the glass's CSS size, not its device size, so a 1x
      // preview and a 2x render show the same rain rather than the render
      // getting bigger drops.
      const shortSide = Math.min(box.width, box.height) / Math.max(fc.pixelRatio, 0.01);
      return [
        {
          kind: "shader",
          fragment: DROPLETS_FRAG,
          uniforms: {
            ...paramUniforms(params, SPECS, fc.pixelRatio),
            u_tint: colour,
            u_time: fc.time,
            u_resolution: [fc.width, fc.height],
            // The node's box inside the captured region: device px from the
            // region's top-left, y growing down, matching contentRect.
            u_contentOrigin: [box.x, box.y],
            u_contentSize: [Math.max(box.width, 1), Math.max(box.height, 1)],
            u_sizeRef: Math.min(Math.max(shortSide / 900, 0.75), 1.35),
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

  defineParams(effect, SPECS, scalars as Record<string, number>, attachments, "droplets");
  return effect as unknown as Droplets;
}
