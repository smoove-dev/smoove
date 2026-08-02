import type { ObjectFit } from "@smoove/core";
import type { LottieData } from "./types.js";

/** What {@link LottieEngineFactory} is handed when a node needs a renderer. */
export type LottieEngineOptions = {
  /** Render surface size in device pixels. */
  width: number;
  height: number;
  src?: string;
  data?: LottieData;
  /** How the animation scales into the surface. */
  fit: ObjectFit;
  /** Alignment in 0..1 surface coordinates — `[0.5, 0.5]` is centered. */
  align: [number, number];
  /** Named marker to use as the playback range. */
  marker?: string;
};

/**
 * A frame-pure Lottie rasterizer. `setFrame` must be synchronous and
 * deterministic: the same frame must always produce the same `buffer`.
 *
 * The seam lives in this package rather than in `@smoove/core` because — unlike
 * media, where the renderer swaps browser decoding for Node decoding — the
 * default engine is already environment-agnostic. `@smoove/renderer` needs no
 * knowledge of Lottie at all. This interface exists so engines are stubbable in
 * tests and replaceable later.
 */
export interface LottieEngine {
  /** Resolves once the WASM and the animation are loaded. Rejects on load failure. */
  readonly ready: Promise<void>;
  /** The animation's own frame rate. `0` before {@link ready} resolves. */
  readonly fps: number;
  /** The animation's total frame count. `0` before {@link ready} resolves. */
  readonly totalFrames: number;
  /** The animation's length in seconds. `0` before {@link ready} resolves. */
  readonly duration: number;
  /** The animation's authored size, or `null` if unknown. */
  readonly intrinsicSize: { width: number; height: number } | null;
  /** The effective Lottie-frame range `[start, end)`, honouring `marker`. */
  readonly segment: [number, number];
  /** Render a (possibly fractional) Lottie frame. Synchronous. */
  setFrame(frame: number): void;
  /** RGBA pixels for the last rendered frame, or `null` before the first render. */
  readonly buffer: Uint8Array | null;
  /** Resize the render surface. No-op when the size is unchanged. */
  resize(width: number, height: number): void;
  destroy(): void;
}

export type LottieEngineFactory = (options: LottieEngineOptions) => LottieEngine;

let defaultFactory: LottieEngineFactory | null = null;

/** Register the engine `Lottie` nodes use when none is injected per node. */
export function setDefaultLottieEngineFactory(factory: LottieEngineFactory): void {
  defaultFactory = factory;
}

export function getDefaultLottieEngineFactory(): LottieEngineFactory {
  if (!defaultFactory) {
    throw new Error(
      "[smoove] No Lottie engine registered. Import @smoove/lottie (not a deep path) so the default engine registers itself.",
    );
  }
  return defaultFactory;
}
