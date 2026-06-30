import type { Composition } from "@smoove/core";
import type { CompositionInfo } from "./types.js";

/** Read a composition's metadata without rendering anything. */
export function probeComposition(comp: Composition): CompositionInfo {
  const durationInFrames = comp.durationInFrames.get();
  return {
    fps: comp.fps,
    durationInFrames,
    width: comp.width(),
    height: comp.height(),
    durationInSeconds: durationInFrames / comp.fps,
    isRendering: comp.environment.isRendering,
  };
}
