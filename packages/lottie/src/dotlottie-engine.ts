import { DotLottie } from "@lottiefiles/dotlottie-web";
import type { LottieEngine, LottieEngineOptions } from "./engine.js";
import { ensureLottieWasm } from "./wasm.js";

/**
 * A {@link LottieEngine} backed by dotlottie-web (ThorVG/WASM). Renders into a
 * bare `RenderSurface` — no canvas, no DOM — so the browser and the headless
 * renderer run byte-identical rasterization.
 */
class DotLottieEngine implements LottieEngine {
  readonly ready: Promise<void>;

  private _player: DotLottie | null = null;
  private _width: number;
  private _height: number;
  private _lastFrame: number | null = null;

  constructor(options: LottieEngineOptions) {
    this._width = Math.max(1, Math.round(options.width));
    this._height = Math.max(1, Math.round(options.height));
    this.ready = this._load(options);
  }

  private async _load(options: LottieEngineOptions): Promise<void> {
    await ensureLottieWasm();
    const player = new DotLottie({
      canvas: { width: this._width, height: this._height },
      src: options.src,
      data: options.data,
      marker: options.marker,
      autoplay: false,
      loop: false,
      useFrameInterpolation: true,
      // Our `ObjectFit` vocabulary is a subset of dotlottie's `Fit`.
      layout: { fit: options.fit, align: options.align },
    });
    this._player = player;
    await new Promise<void>((resolve, reject) => {
      player.addEventListener("load", () => resolve());
      player.addEventListener("loadError", (event) =>
        reject(event.error ?? new Error("[smoove] Lottie failed to load")),
      );
    });
  }

  get fps(): number {
    const p = this._player;
    if (!p || p.duration <= 0) return 0;
    return p.totalFrames / p.duration;
  }

  get totalFrames(): number {
    return this._player?.totalFrames ?? 0;
  }

  get duration(): number {
    return this._player?.duration ?? 0;
  }

  get intrinsicSize(): { width: number; height: number } | null {
    const size = this._player?.animationSize();
    if (!size || size.width <= 0 || size.height <= 0) return null;
    return { width: size.width, height: size.height };
  }

  get segment(): [number, number] {
    const p = this._player;
    if (!p) return [0, 0];
    // dotlottie reports an inclusive [start, end] frame pair; we use a
    // half-open range everywhere else, so widen the end by one.
    const seg = p.segment;
    if (!seg) return [0, p.totalFrames];
    return [seg[0], seg[1] + 1];
  }

  setFrame(frame: number): void {
    const p = this._player;
    if (!p) return;
    if (this._lastFrame === frame) return;
    this._lastFrame = frame;
    p.setFrame(frame);
  }

  get buffer(): Uint8Array | null {
    return this._player?.buffer ?? null;
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w === this._width && h === this._height) return;
    this._width = w;
    this._height = h;
    this._lastFrame = null; // Force a re-render into the new surface.
    this._player?.setCanvas({ width: w, height: h });
  }

  destroy(): void {
    this._player?.destroy();
    this._player = null;
  }
}

export function createDotLottieEngine(options: LottieEngineOptions): LottieEngine {
  return new DotLottieEngine(options);
}
