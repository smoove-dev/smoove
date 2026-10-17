import {
  declaredHeight,
  declaredWidth,
  FlexShape,
  getComposition,
  type ObjectFit,
  type ObjectPosition,
  TICK_MARK,
} from "@smoove/core";
import Konva from "konva";
import {
  getDefaultLottieEngineFactory,
  type LottieEngine,
  type LottieEngineOptions,
} from "./engine.js";
import { blit, createSurface, type LottieSurface, resizeSurface } from "./surface.js";
import { type LottieTiming, lottieFrameAt } from "./timing.js";
import type { LottieConfig } from "./types.js";

const LOTTIE_KEYS = [
  "src",
  "data",
  "objectFit",
  "objectPosition",
  "cornerRadius",
  "trimBefore",
  "trimAfter",
  "loop",
  "speed",
  "marker",
  "segment",
  "pixelRatio",
  "engineFactory",
] as const;

const MAX_PIXEL_RATIO = 3;

/** `objectPosition` as dotlottie's 0..1 `[x, y]` alignment pair. */
const ALIGNMENTS: Record<ObjectPosition, [number, number]> = {
  center: [0.5, 0.5],
  top: [0.5, 0],
  bottom: [0.5, 1],
  left: [0, 0.5],
  right: [1, 0.5],
  "top left": [0, 0],
  "top right": [1, 0],
  "bottom left": [0, 1],
  "bottom right": [1, 1],
};

function stripConfig(config: LottieConfig): LottieConfig {
  const out: Record<string, unknown> = { ...config };
  for (const key of LOTTIE_KEYS) delete out[key];
  return out as LottieConfig;
}

type Corners = [number, number, number, number];

function normalizeCorners(value: number | number[]): Corners {
  if (typeof value === "number") return [value, value, value, value];
  const [a = 0, b = a, c = a, d = b] = value;
  return [a, b, c, d];
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radii: Corners,
): void {
  const [tl, tr, br, bl] = radii;
  ctx.beginPath();
  ctx.moveTo(tl, 0);
  ctx.lineTo(width - tr, 0);
  ctx.arcTo(width, 0, width, tr, tr);
  ctx.lineTo(width, height - br);
  ctx.arcTo(width, height, width - br, height, br);
  ctx.lineTo(bl, height);
  ctx.arcTo(0, height, 0, height - bl, bl);
  ctx.lineTo(0, tl);
  ctx.arcTo(0, 0, tl, 0, tl);
  ctx.closePath();
}

const LottieBase = FlexShape<Konva.Shape, LottieConfig>(Konva.Shape);

/**
 * A Lottie animation on the composition's clock. The engine rasterizes into an
 * offscreen surface each frame and this shape paints that surface, so the node
 * is frame-pure: `setFrame(n)` always yields the same pixels, in the browser
 * and in a headless render alike.
 */
export class Lottie extends LottieBase {
  /** Resolves once the animation is loaded. */
  readonly ready: Promise<void>;

  private readonly _engine: LottieEngine;
  private readonly _trimBefore: number;
  private readonly _trimAfter?: number;
  private readonly _loop: boolean;
  private readonly _speed: number;
  private readonly _segment?: [number, number];
  private readonly _pixelRatio?: number;
  private readonly _cornerRadius?: Corners;
  private _surface: LottieSurface;
  private _loaded = false;
  private _renderGated = false;
  private _lastFrame: number | null = null;

  constructor(config: LottieConfig) {
    super(stripConfig(config));

    if (config.src !== undefined && config.data !== undefined) {
      throw new Error("[smoove] Lottie: src and data are mutually exclusive — provide one");
    }
    if (config.src === undefined && config.data === undefined) {
      throw new Error("[smoove] Lottie: one of src or data is required");
    }

    this.setAttr(TICK_MARK, true);

    this._trimBefore = config.trimBefore ?? 0;
    this._trimAfter = config.trimAfter;
    this._loop = config.loop ?? false;
    this._speed = config.speed ?? 1;
    this._segment = config.segment;
    this._pixelRatio = config.pixelRatio;
    this._cornerRadius =
      config.cornerRadius === undefined ? undefined : normalizeCorners(config.cornerRadius);

    const fit: ObjectFit = config.objectFit ?? "contain";
    const align = ALIGNMENTS[config.objectPosition ?? "center"];

    // Start at the box size we know about; _syncSurface resizes once laid out.
    const initial = this._surfaceSize();
    this._surface = createSurface(initial.width, initial.height);

    const options: LottieEngineOptions = {
      width: this._surface.width,
      height: this._surface.height,
      src: config.src,
      data: config.data,
      fit,
      align,
      marker: config.marker,
    };
    const factory = config.engineFactory ?? getDefaultLottieEngineFactory();
    this._engine = factory(options);

    this.ready = this._engine.ready
      .then(() => {
        this._loaded = true;
        this._applyIntrinsicSize();
        // Re-apply the current frame. Until now every tick bailed out on
        // `_loaded`, so nothing has seeked or blitted yet — and if the playhead
        // never moves again (a paused player, or a still at frame 0) no further
        // tick would ever come. `refresh()` re-runs the frame in place.
        const stage = this.getStage();
        const comp = stage ? getComposition(stage) : null;
        if (comp) comp.refresh();
        else this.getLayer()?.batchDraw();
      })
      .catch((err: unknown) => {
        console.error("[smoove] Lottie load failed:", err);
      });

    // Preview: hold playback until the animation is ready, the same way
    // `Image` and `Font` do. Deferred to a microtask so the node has had a
    // chance to be added to a composition.
    //
    // The `_loaded` guard matters: `registerAsset` flips the composition to
    // "buffering" and hides every sequence the moment it is called, so
    // registering an already-settled load would blank the stage for a frame
    // for nothing. An inline `data` payload (or a warm cache) resolves before
    // this microtask runs, and needs no buffering at all.
    queueMicrotask(() => {
      if (this._loaded) return;
      const stage = this.getStage();
      const comp = stage ? getComposition(stage) : null;
      if (comp && !comp.environment.isRendering) comp.registerAsset(this.ready);
    });

    this.sceneFunc(this._sceneFunc.bind(this) as Konva.Shape["sceneFunc"]);
    this.hitFunc(((ctx: Konva.Context, shape: Konva.Shape) => {
      ctx.beginPath();
      ctx.rect(0, 0, this.width(), this.height());
      ctx.closePath();
      ctx.fillStrokeShape(shape);
    }) as Konva.Shape["hitFunc"]);

    this.on("widthChange heightChange", () => this._syncSurface());
  }

  /** Size the animation to itself when the author gave no explicit size. */
  private _applyIntrinsicSize(): void {
    const size = this._engine.intrinsicSize;
    if (!size) return;
    if (declaredWidth(this) === undefined) this._kmBoxWidth(size.width);
    if (declaredHeight(this) === undefined) this._kmBoxHeight(size.height);
    this._syncSurface();
  }

  private _effectivePixelRatio(): number {
    if (this._pixelRatio !== undefined) return Math.max(0.1, this._pixelRatio);
    const stage = this.getStage();
    const ratio = stage?.getLayers()[0]?.getCanvas().getPixelRatio() ?? 1;
    return Math.min(MAX_PIXEL_RATIO, Math.max(0.1, ratio));
  }

  private _surfaceSize(): { width: number; height: number } {
    const ratio = this._effectivePixelRatio();
    return {
      width: Math.max(1, Math.round(Math.max(1, this.width()) * ratio)),
      height: Math.max(1, Math.round(Math.max(1, this.height()) * ratio)),
    };
  }

  /** Keep the engine surface matched to the node's box at output resolution. */
  private _syncSurface(): void {
    const { width, height } = this._surfaceSize();
    if (width === this._surface.width && height === this._surface.height) return;
    this._surface = resizeSurface(this._surface, width, height);
    this._engine.resize(width, height);
    this._lastFrame = null;
  }

  private _timing(fps: number): LottieTiming {
    const [segStart, segEnd] = this._segment ?? this._engine.segment;
    return {
      fps,
      lottieFps: this._engine.fps,
      totalFrames: this._engine.totalFrames,
      trimBefore: this._trimBefore,
      trimAfter: this._trimAfter,
      loop: this._loop,
      speed: this._speed,
      segment: [segStart, segEnd],
    };
  }

  /**
   * @internal — called by `Sequence`/`Clip` each tick while on-stage. Gates the
   * offline render on the load, then seeks the engine and blits the frame.
   */
  _kmTick(localFrame: number): void {
    const stage = this.getStage();
    const comp = stage ? getComposition(stage) : null;

    if (!this._renderGated && !this._loaded && comp?.environment.isRendering) {
      this._renderGated = true;
      const handle = comp.delayRender("load lottie");
      this.ready.finally(() => comp.continueRender(handle));
    }
    if (!this._loaded) return;

    this._syncSurface();
    const frame = lottieFrameAt(localFrame, this._timing(comp?.fps ?? 0));
    if (this._lastFrame === frame) return;
    this._lastFrame = frame;
    this._engine.setFrame(frame);
    blit(this._surface, this._engine.buffer);
  }

  /** @internal — called when the host timeline leaves range. */
  _kmDeactivate(): void {}

  private _sceneFunc(context: Konva.Context): void {
    if (!this._loaded) return;
    const ctx = (context as unknown as { _context: CanvasRenderingContext2D })._context;
    const w = this.width();
    const h = this.height();
    if (w <= 0 || h <= 0) return;
    ctx.save();
    if (this._cornerRadius) {
      roundRectPath(ctx, w, h, this._cornerRadius);
      ctx.clip();
    }
    ctx.drawImage(this._surface.canvas, 0, 0, w, h);
    ctx.restore();
  }

  /** Release the engine's WASM resources. */
  override destroy(): this {
    this._engine.destroy();
    return super.destroy();
  }
}
