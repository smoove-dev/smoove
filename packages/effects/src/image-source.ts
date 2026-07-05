import {
  type EffectChainResult,
  type EffectPass,
  getDefaultImageLoader,
  type KMEffectRuntime,
} from "@smoove/core";
import Konva from "konva";
import type { ParamSchema } from "./params.js";
import type { ProcessedImage, SizedImage } from "./processing/heatmap-field.js";
import { ShaderSource, type ShaderSourceConfig } from "./source.js";

export type ImageShaderSourceConfig = ShaderSourceConfig & {
  /** The logo/artwork the effect animates: a URL (loaded via the runtime's image loader) or an already-loaded image/canvas. */
  src: string | CanvasImageSource;
};

/**
 * Base for image-driven shader sources (Heatmap, LiquidMetal, GemSmoke): the
 * fragment doesn't run over the node's own pixels but over a *pre-processed*
 * version of a source image (edge/blur fields packed into color channels,
 * computed once on load). Rendering feeds that processed canvas through the
 * runtime's chain executor so the fragment can sample it as `u_texture`.
 */
export abstract class ImageShaderSource extends ShaderSource {
  private _processed: ProcessedImage | null = null;
  /** The processed field rescaled to the node size (platforms upload exactly width×height). */
  private _scaled: { canvas: HTMLCanvasElement; w: number; h: number } | null = null;

  protected constructor(
    schema: ParamSchema,
    fragment: string,
    process: (image: SizedImage) => ProcessedImage,
    config: ImageShaderSourceConfig,
  ) {
    super(schema, fragment, config);
    const ready = (img: SizedImage) => {
      this._processed = process(img);
      this.getLayer()?.batchDraw();
    };
    if (typeof config.src === "string") {
      getDefaultImageLoader()(config.src)
        .then((img) => ready(img as SizedImage))
        .catch((err: unknown) => {
          console.error("[smoove/effects] image source failed to load:", err);
        });
    } else {
      ready(config.src as SizedImage);
    }
  }

  protected override _render(
    runtime: KMEffectRuntime,
    pass: EffectPass,
    width: number,
    height: number,
  ): EffectChainResult | null {
    if (!this._processed) return null; // image still loading
    if (!this._scaled || this._scaled.w !== width || this._scaled.h !== height) {
      const canvas = Konva.Util.createCanvasElement();
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this._processed.canvas, 0, 0, width, height);
      this._scaled = { canvas, w: width, h: height };
    }
    // The field is displayed stretched to the node, so the visible aspect is
    // the node's — that's what the fragment's aspect correction must undo.
    pass.uniforms.u_imageAspectRatio = width / height;
    pass.uniforms.u_isImage = true;
    return runtime.applyChain(this._scaled.canvas, [pass], width, height);
  }
}
