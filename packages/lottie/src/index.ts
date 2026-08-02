/**
 * @smoove/lottie — timeline-driven Lottie animations for smoove.
 *
 * Importing this module registers the dotlottie-web engine as the default, so
 * a `Lottie` node needs no setup. The engine rasterizes with ThorVG/WASM into a
 * DOM-free surface, which is why preview and headless render produce the same
 * pixels.
 */
import { createDotLottieEngine } from "./dotlottie-engine.js";
import { setDefaultLottieEngineFactory } from "./engine.js";

setDefaultLottieEngineFactory(createDotLottieEngine);

export { createDotLottieEngine } from "./dotlottie-engine.js";
export {
  getDefaultLottieEngineFactory,
  type LottieEngine,
  type LottieEngineFactory,
  type LottieEngineOptions,
  setDefaultLottieEngineFactory,
} from "./engine.js";
export { Lottie } from "./lottie.js";
export {
  type LottieTiming,
  lottieFrameAt,
  naturalDurationInFrames,
  resolveSegment,
} from "./timing.js";
export type { LottieConfig, LottieData } from "./types.js";
export { setLottieWasmUrl } from "./wasm.js";
