import type { EffectFrameContext, EffectPadding, EffectPass, SmooveEffect } from "@smoove/core";
import { BLUR_LENS_FRAG } from "./glsl/blur-lens.frag.js";
import { Attachments, defineParams, type ParamSpecs, paramUniforms } from "./params.js";

/** Which kernel a blur runs, and therefore what it costs. */
export type BlurType = "gaussian" | "lens";

/**
 * Every blur parameter, with its bounds and whether it is a CSS-px length.
 *
 * `radius` means the same visual spread under either type. A disc of radius R
 * has a standard deviation of R/2, so the gaussian path asks `ctx.filter` for
 * a sigma of `radius / 2` while the lens path uses `radius` as its disc radius.
 * Switching `type` then changes the character and not the amount, which is what
 * makes the two comparable at all.
 */
const SPECS: ParamSpecs = {
  radius: { default: 8, min: 0, max: 200, px: true },
  bloom: { default: 0.5, min: 0, max: 1 },
  blades: { default: 0, min: 0, max: 12 },
  bladeAngle: { default: 0, min: -360, max: 360 },
};

type ScalarParams = {
  /** How far the blur reaches, in CSS px. The same amount under either type. */
  radius: number;
  /** Lens only. How hard highlights bloom (0 to 1). 0 is a flat disc, 1 is full bokeh balls. */
  bloom: number;
  /** Lens only. Aperture sides (0 to 12). Under 3 is a round aperture. */
  blades: number;
  /** Lens only. Orientation of a polygonal aperture, in degrees. */
  bladeAngle: number;
};

export type BlurOptions = Partial<ScalarParams> & {
  /**
   * `"gaussian"` (the default) is one CSS filter: soft, characterless, and
   * nearly free. `"lens"` is an optical defocus through a real aperture —
   * blooming highlights, shaped bokeh — and costs a shader pass.
   */
  type?: BlurType;
};

/** A live blur instance: mutate a param to animate it. */
export type Blur = SmooveEffect &
  ScalarParams & {
    /** Swap the kernel. `bloom`, `blades` and `bladeAngle` only apply to `"lens"`. */
    type: BlurType;
  };

/**
 * Blur a node, either as a plain softening or as a real lens defocus.
 *
 * `type: "gaussian"` is the workhorse: one `ctx.filter` pass, which Skia
 * implements natively and browsers run on the GPU. It never reads pixels back,
 * so a chain containing only it keeps the fast rasterizer. Reach for it to
 * push a backdrop away, to soften a plate behind a title, or to blur something
 * in as it arrives.
 *
 * `type: "lens"` is what a camera does. A Gaussian kernel falls off, so a
 * bright specular gets dimmer as it spreads and the result reads as frosted
 * glass; a lens defocuses through a flat aperture disc, so the specular keeps
 * its brightness and grows into a bokeh ball. `bloom` controls how hard those
 * highlights hold up, and `blades` shapes them — 6 gives the hexagonal bokeh of
 * a six-blade iris, 0 leaves them round.
 *
 * ```ts
 * backdrop.effects([blur({ radius: 24 })]);
 * plate.effects([blur({ type: "lens", radius: 32, bloom: 0.7, blades: 6 })]);
 * ```
 *
 * A focus pull is an animation like any other:
 *
 * ```ts
 * const focus = blur({ type: "lens", radius: 40 });
 * title.effects([focus]);
 * seq.register((frame) => {
 *   focus.radius = interpolate(frame, [0, 24], [40, 0], { extrapolateRight: "clamp" });
 * });
 * ```
 *
 * At `radius: 0` the effect switches off and the node draws through the normal
 * path, so a sharp node costs nothing.
 *
 * Cost is the padded region's area, not the node's, and a blur pads by its own
 * radius on every side — a radius of 24 on a 200x40 title captures about five
 * times the node's pixels. Keep the node's box tight, put the blur on the node
 * rather than on a Sequence, and prefer `"gaussian"` wherever the character of
 * the highlights does not show.
 *
 * `type: "lens"` requires a WebGL platform: without one the pass is skipped,
 * the node draws sharp, and a warning is logged once. `"gaussian"` has no such
 * requirement.
 */
export function blur(options: BlurOptions = {}): Blur {
  const { type = "gaussian", ...scalars } = options;
  if (type !== "gaussian" && type !== "lens") {
    throw new Error(`blur: type must be "gaussian" or "lens", got ${String(type)}`);
  }
  const attachments = new Attachments();
  let kernel: BlurType = type;

  const effect = {
    _fxEffect: true as const,

    get type(): BlurType {
      return kernel;
    },
    set type(next: BlurType) {
      kernel = next;
      attachments.invalidate();
    },

    /** At radius 0 nothing moves, so the node draws through the normal path. */
    enabled(): boolean {
      return (effect as unknown as ScalarParams).radius > 0;
    },

    /**
     * Both kernels are isotropic, so this is a scalar rather than a per-side
     * box, and it is in CSS px — the pipeline scales it by `pixelRatio` itself.
     *
     * The disc has hard support at exactly `radius`; the two extra px cover the
     * tap dither and the half-texel the linear filter reads past its sample.
     *
     * The Gaussian needs far more. `ctx.filter: blur(sigma)` still sits at
     * about 1.1% of peak at 3 sigma, which against a bright node is roughly
     * 3/255 and reads as a faint rectangle at the region boundary. Four sigma
     * is 0.03% and invisible, and with sigma being `radius / 2` that is
     * `2 * radius`.
     */
    padding(): EffectPadding {
      const { radius } = effect as unknown as ScalarParams;
      return kernel === "lens" ? radius + 2 : radius * 2;
    },

    passes(fc: EffectFrameContext): EffectPass[] {
      const params = effect as unknown as ScalarParams;

      if (kernel === "gaussian") {
        // `paramUniforms` scales px-valued params into device px for shader
        // uniforms; a filter string gets no such help, so the multiply is by
        // hand here. Miss it and a 1x preview stops matching a 2x render.
        const sigma = (params.radius / 2) * fc.pixelRatio;
        return [{ kind: "css", filter: `blur(${sigma}px)` }];
      }

      const box = fc.contentRect;
      return [
        {
          kind: "shader",
          fragment: BLUR_LENS_FRAG,
          uniforms: {
            ...paramUniforms(params as unknown as Record<string, number>, SPECS, fc.pixelRatio),
            u_resolution: [fc.width, fc.height],
            // Only the tap dither reads this; the blur itself runs over the
            // whole region, since spreading into the padding is the point.
            u_contentOrigin: [box.x, box.y],
            // Overrides the degrees `paramUniforms` just wrote: it scales px
            // params but knows nothing about angles, and the shader folds
            // sectors in radians.
            u_bladeAngle: (params.bladeAngle * Math.PI) / 180,
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

  defineParams(effect, SPECS, scalars as Record<string, number>, attachments, "blur");
  return effect as unknown as Blur;
}
