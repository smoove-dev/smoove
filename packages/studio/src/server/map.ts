import type { QualityPreset, RenderOptions, StillOptions } from "@konva-motion/renderer";
import type { RenderRequest } from "../types.js";

/**
 * Pure mappers from the studio-side {@link RenderRequest} to the renderer's
 * option shapes. No I/O, no HTTP — just translation, so a host (or another
 * runtime) can reuse them without pulling in any transport assumptions.
 */

/** Studio quality string → renderer encode preset. */
const QUALITY_BY_NAME: Record<string, QualityPreset> = {
  draft: "low",
  standard: "medium",
  high: "high",
  lossless: "max",
};

export function qualityPreset(quality: string): QualityPreset {
  return QUALITY_BY_NAME[quality] ?? "medium";
}

/** Container metadata for a video format request. */
export function videoMeta(format: string): { ext: string; contentType: string } {
  switch (format) {
    case "webm":
      return { ext: "webm", contentType: "video/webm" };
    case "mov":
      return { ext: "mov", contentType: "video/quicktime" };
    default:
      return { ext: "mp4", contentType: "video/mp4" };
  }
}

/** Image metadata for a still format request. */
export function stillMeta(format: string): {
  ext: string;
  contentType: string;
  type: "png" | "jpeg";
} {
  switch (format) {
    case "jpeg":
    case "jpg":
      return { ext: "jpg", contentType: "image/jpeg", type: "jpeg" };
    default:
      // The renderer rasterizes png/jpeg only; anything else falls back to PNG.
      return { ext: "png", contentType: "image/png", type: "png" };
  }
}

/** A video {@link RenderRequest} → `renderComposition` options writing to `output`. */
export function toRenderOptions(req: RenderRequest, output: string): RenderOptions {
  const opts: RenderOptions = {
    output,
    resolution: { width: req.w, height: req.h },
    fps: req.fps,
    quality: qualityPreset(req.quality),
    // The renderer encodes mp4 (H.264/AAC) or webm (VP9/Opus); other containers
    // (e.g. mov) fall back to mp4.
    format: videoMeta(req.format).ext === "webm" ? "webm" : "mp4",
  };
  // `to` is inclusive in both the studio region and the renderer's FrameRange.
  if (req.from != null && req.to != null) opts.range = { from: req.from, to: req.to };
  return opts;
}

/** A still {@link RenderRequest} → `renderStill` options writing to `output`. */
export function toStillOptions(req: RenderRequest, output: string): StillOptions {
  return {
    frame: req.frameNo ?? 0,
    output,
    resolution: { width: req.w, height: req.h },
    type: stillMeta(req.format).type,
  };
}
