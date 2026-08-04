import type { EffectFrameContext, EffectPass, SmooveEffect } from "@smoove/core";
import { CHROMA_KEY_FRAG } from "./glsl/chroma-key.frag.js";
import {
  Attachments,
  type ColorInput,
  defineParams,
  type ParamSpecs,
  paramUniforms,
  parseColor,
} from "./params.js";

/**
 * Every chromaKey parameter, with its bounds and whether it is a CSS-px length.
 *
 * `similarity` and `smoothness` are measured relative to the key colour's own
 * distance from grey, so 1 lands on neutral no matter how saturated the screen
 * was, and one setting carries from a bright screen to a dull one. The ceiling
 * is 0.95 rather than 1 because a key reaching neutral takes the greys and
 * whites of the subject with it.
 */
const SPECS: ParamSpecs = {
  strength: { default: 1, min: 0, max: 1 },
  similarity: { default: 0.5, min: 0, max: 0.95 },
  smoothness: { default: 0.15, min: 0, max: 0.5 },
  spill: { default: 0.5, min: 0, max: 1 },
  choke: { default: 0, min: -8, max: 8, px: true },
};

type ScalarParams = {
  /** How much of the key to apply (0 to 1). Animate from 0 to dissolve the background away. */
  strength: number;
  /** How far toward neutral grey the key reaches (0 to 0.95). 0 is the key colour, 1 is grey. */
  similarity: number;
  /** Width of the ramp between removed and kept, in the same units (0 to 0.5). */
  smoothness: number;
  /** How much of the screen's colour cast to subtract from what is left (0 to 1). */
  spill: number;
  /** Shrink the matte by this many CSS px to eat a fringe; negative grows it back. */
  choke: number;
};

export type ChromaKeyOptions = Partial<ScalarParams> & {
  /**
   * The colour to remove, as a hex string or `[r, g, b]` in 0..1. Defaults to
   * pure green. Sample it from the footage rather than guessing: a screen lit
   * for camera is nothing like `#00ff00`.
   */
  color?: ColorInput;
};

/** A live chromaKey instance: mutate a param to animate it. */
export type ChromaKey = SmooveEffect &
  ScalarParams & {
    /**
     * The key colour. Assign a hex string or a triplet; reading it back always
     * gives the parsed `[r, g, b]` in 0..1.
     */
    color: ColorInput;
  };

/**
 * Green-screen keying: one colour becomes transparency, and whatever the node
 * sits on shows through.
 *
 * One single-pass fragment shader over the captured node. The matte is a
 * distance in chroma rather than in RGB, so brightness plays no part and a
 * shadow across the screen keys like the lit part of it. That distance is
 * measured relative to how saturated the key colour itself is — `similarity`
 * of 1 would reach all the way to neutral grey — so a setting that worked on a
 * bright screen still works on a dull one. What survives is despilled: the
 * screen's colour cast is subtracted out of the fringe it bounced onto hair and
 * shoulders, at unchanged brightness. `choke` trims or restores a pixel or two
 * of edge where compression left one.
 *
 * The key reads pixels and nothing else, so it is frame-pure by construction:
 * seeking to frame 900 gives the same matte as playing to it.
 *
 * Put it on the node carrying the footage, not on the Sequence: an effect only
 * touches the node it is on, so keying the `Video` leaves titles and graphics
 * above it untouched, and anything added behind it shows through.
 *
 * ```ts
 * const clip = new Video({ src, width: 480, height: 720, objectFit: "cover" });
 * clip.effects([chromaKey({ color: "#3ea346", similarity: 0.6 })]);
 * ```
 *
 * `color` has to match the screen as the camera saw it. Sample a frame with an
 * eyedropper and paste the hex in; then widen `similarity` until the screen is
 * gone, and only then raise `smoothness` for the edge. Keying a white, grey or
 * black background works, on plain RGB distance instead of chroma, but there is
 * no hue to separate the subject from — expect to spend longer on `similarity`.
 *
 * Requires a WebGL platform: without one the pass is skipped, the node draws
 * unkeyed, and a warning is logged once.
 */
export function chromaKey(options: ChromaKeyOptions = {}): ChromaKey {
  const { color = [0, 1, 0], ...scalars } = options;
  const attachments = new Attachments();
  let colour = parseColor("chromaKey", "color", color);

  const effect = {
    _fxEffect: true as const,

    get color(): ColorInput {
      return colour;
    },
    set color(next: ColorInput) {
      colour = parseColor("chromaKey", "color", next);
      attachments.invalidate();
    },

    /** At strength 0 nothing is removed, so the node draws through the normal path. */
    enabled(): boolean {
      return (effect as unknown as ScalarParams).strength > 0;
    },

    // No padding: keying only takes pixels away, and `choke` grows the matte
    // inside the node's own box, so the captured region is as small as it can be.

    passes(fc: EffectFrameContext): EffectPass[] {
      const params = effect as unknown as Record<string, number>;
      const box = fc.contentRect;
      return [
        {
          kind: "shader",
          fragment: CHROMA_KEY_FRAG,
          uniforms: {
            ...paramUniforms(params, SPECS, fc.pixelRatio),
            u_key: colour,
            u_resolution: [fc.width, fc.height],
            // The node's box inside the captured region: device px from the
            // region's top-left, y growing down, matching contentRect.
            u_contentOrigin: [box.x, box.y],
            u_contentSize: [Math.max(box.width, 1), Math.max(box.height, 1)],
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

  defineParams(effect, SPECS, scalars as Record<string, number>, attachments, "chromaKey");
  return effect as unknown as ChromaKey;
}
