import Konva from "konva";
import { getComposition } from "../../engine/composition.js";
import { detectEnvironment, getEnvironment } from "../../engine/environment.js";
import { type ReadonlySignal, type Signal, createSignal } from "../../engine/signal.js";
import { parseSize } from "../../layout/flex/engine.js";
import type { SizeValue } from "../../layout/flex/types.js";
import type { ObjectFit, ObjectPosition } from "../../layout/image.js";
import type { AudioChannel, AudioMixer } from "../audio/mixer.js";
import { MEDIA_MARK, VIDEO_MARK } from "../media-marker.js";
import type { VideoDriver, VideoDriverContext, VideoTiming } from "./driver.js";
import type { VideoConfig } from "./types.js";
import { PreviewVideoDriver } from "./video-for-preview.js";
import { RenderingVideoDriver } from "./video-for-rendering.js";
import { BrowserVideoSource } from "./video-source-browser.js";
import type { VideoSource } from "./video-source.js";

const VIDEO_KEYS = [
  "src",
  "trimBefore",
  "trimAfter",
  "startFrom",
  "endAt",
  "loop",
  "muted",
  "volume",
  "playbackRate",
  "objectFit",
  "objectPosition",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "margin",
  "sourceFactory",
] as const;

function pickKonvaConfig(config: VideoConfig): Konva.GroupConfig {
  const out: Record<string, unknown> = { ...config };
  for (const k of VIDEO_KEYS) delete out[k];
  const w = parseSize(config.width as SizeValue | undefined);
  const h = parseSize(config.height as SizeValue | undefined);
  out.width = w?.kind === "px" ? w.value : undefined;
  out.height = h?.kind === "px" ? h.value : undefined;
  out.cornerRadius = undefined;
  return out as Konva.GroupConfig;
}

/**
 * Timeline-driven video. API mirrors {@link Image} (`new Video({src, ...ImageProps})`)
 * but the frame source is a runtime-agnostic {@link VideoSource} and playback is
 * driven by the composition's frame clock. Picks a {@link RenderingVideoDriver}
 * or {@link PreviewVideoDriver} based on the composition's {@link Environment}.
 */
export class Video extends Konva.Group implements AudioChannel {
  /** Human label for mixer UIs — `config.name`, falling back to `config.src`. */
  readonly label: string;
  /** Intrinsic audio level, 0..1 — scaled by the composition mixer's master. */
  readonly volume: ReadonlySignal<number>;
  readonly muted: ReadonlySignal<boolean>;

  private readonly _img: Konva.Image;
  private readonly _source: VideoSource;
  private readonly _trimBefore: number;
  private readonly _trimAfter?: number;
  private readonly _loop: boolean;
  private readonly _playbackRate: number;
  private readonly _volume: Signal<number>;
  private readonly _muted: Signal<boolean>;
  private _mixer: AudioMixer | null = null;
  private _driver: VideoDriver | null = null;

  constructor(config: VideoConfig) {
    super(pickKonvaConfig(config));
    this.setAttr(MEDIA_MARK, true);
    this.setAttr(VIDEO_MARK, true);

    this._trimBefore = config.trimBefore ?? config.startFrom ?? 0;
    this._trimAfter = config.trimAfter ?? config.endAt;
    this._loop = config.loop ?? false;
    this._playbackRate = config.playbackRate ?? 1;

    this.label = config.name ?? config.src;
    this._volume = createSignal(config.volume ?? 1);
    this._muted = createSignal(config.muted ?? false);
    this.volume = this._volume;
    this.muted = this._muted;

    this._img = new Konva.Image({ image: undefined, listening: false });
    super.add(this._img);

    this.setAttrs({
      flexGrow: config.flexGrow,
      flexShrink: config.flexShrink,
      flexBasis: config.flexBasis,
      alignSelf: config.alignSelf,
      margin: config.margin,
      objectFit: config.objectFit ?? "cover",
      objectPosition: config.objectPosition ?? "center",
      cornerRadius: config.cornerRadius,
      flexWidth: config.width,
      flexHeight: config.height,
    });

    if (config.cornerRadius !== undefined) {
      const cr = normalizeCorners(config.cornerRadius);
      this.clipFunc((ctx) => roundRectPath(ctx, 0, 0, this.width(), this.height(), cr));
    }

    this.on("widthChange heightChange", () => this._layoutImage());

    // Build the source eagerly so loading starts immediately. The driver (which
    // needs the attached stage's composition) is resolved lazily on first tick.
    const env = detectEnvironment();
    const factory = config.sourceFactory ?? (() => new BrowserVideoSource());
    this._source = factory(env);
    this._applyAudio(); // honor config volume/muted before a mixer is attached
    this._source.setPlaybackRate(this._playbackRate);
    this._source.onReady(() => {
      const el = this._source.element;
      if (el) this._img.image(el);
      this._layoutImage();
      this.getLayer()?.batchDraw();
    });
    this._source.onFrame(() => {
      this.getLayer()?.batchDraw();
    });
    this._source.load(config.src).catch((err: unknown) => {
      console.error("[konva-motion] Video load failed:", err);
    });

    this._layoutImage();
  }

  /** @internal — called by Sequence on each tick while this video is on-stage. */
  _kmTick(localFrame: number): void {
    const driver = this._ensureDriver();
    driver?.tick(localFrame);
  }

  /** @internal — called by Sequence when it goes out of range. */
  _kmDeactivate(): void {
    this._driver?.deactivate();
  }

  private _ensureDriver(): VideoDriver | null {
    if (this._driver) return this._driver;
    const stage = this.getStage();
    if (!stage) return null;
    const comp = getComposition(stage);
    if (!comp) return null;

    // Lazy fallback for videos added after their sequence was registered.
    comp.mixer.register(this);

    const timing: VideoTiming = {
      fps: comp.fps,
      trimBefore: this._trimBefore,
      trimAfter: this._trimAfter,
      loop: this._loop,
      playbackRate: this._playbackRate,
    };
    const ctx: VideoDriverContext = {
      source: this._source,
      timing,
      comp,
      redraw: () => {
        this._layoutImage();
        this.getLayer()?.batchDraw();
      },
    };
    this._driver = getEnvironment(stage).isRendering
      ? new RenderingVideoDriver(ctx)
      : new PreviewVideoDriver(ctx);
    return this._driver;
  }

  setMuted(muted: boolean): void {
    this._muted.set(muted);
    this._applyAudio();
  }

  setVolume(volume: number): void {
    this._volume.set(Math.max(0, Math.min(1, volume)));
    this._applyAudio();
  }

  /** @internal — {@link AudioMixer} hands us the bus (or null on unregister). */
  _bindMixer(mixer: AudioMixer | null): void {
    this._mixer = mixer;
    this._applyAudio();
  }

  /** @internal — push effective level (master × intrinsic) to the source. */
  _applyAudio(): void {
    const m = this._mixer;
    const master = m ? m.volume.get() : 1;
    const masterMuted = m ? m.muted.get() : false;
    this._source.setVolume(master * this._volume.get());
    this._source.setMuted(masterMuted || this._muted.get());
  }

  setPlaybackRate(rate: number): void {
    this._source.setPlaybackRate(rate);
  }

  override destroy(): this {
    this._mixer?.unregister(this);
    this._mixer = null;
    this._driver?.dispose();
    this._driver = null;
    this._source.destroy();
    return super.destroy();
  }

  /** @internal */
  _layoutImage(): void {
    const w = this.width();
    const h = this.height();
    if (w <= 0 || h <= 0) return;
    const fit = (this.attrs.objectFit ?? "cover") as ObjectFit;
    const pos = (this.attrs.objectPosition ?? "center") as ObjectPosition;
    const nw = this._source.naturalWidth;
    const nh = this._source.naturalHeight;
    if (!this._source.isReady || nw === 0 || nh === 0) return;

    if (fit === "fill") {
      this._img.position({ x: 0, y: 0 });
      this._img.size({ width: w, height: h });
      this._img.crop({ x: 0, y: 0, width: nw, height: nh });
      return;
    }
    if (fit === "none") {
      const { x, y } = positionOffset(pos, w - nw, h - nh);
      this._img.position({ x, y });
      this._img.size({ width: nw, height: nh });
      this._img.crop({ x: 0, y: 0, width: nw, height: nh });
      return;
    }
    if (fit === "contain") {
      const scale = Math.min(w / nw, h / nh);
      const dw = nw * scale;
      const dh = nh * scale;
      const { x, y } = positionOffset(pos, w - dw, h - dh);
      this._img.position({ x, y });
      this._img.size({ width: dw, height: dh });
      this._img.crop({ x: 0, y: 0, width: nw, height: nh });
      return;
    }
    const scale = Math.max(w / nw, h / nh);
    const cropW = w / scale;
    const cropH = h / scale;
    const { x: cx, y: cy } = positionOffset(pos, nw - cropW, nh - cropH);
    this._img.position({ x: 0, y: 0 });
    this._img.size({ width: w, height: h });
    this._img.crop({ x: cx, y: cy, width: cropW, height: cropH });
  }
}

export function isVideoNode(node: Konva.Node): node is Video {
  return node.getAttr(VIDEO_MARK) === true;
}

function positionOffset(
  pos: ObjectPosition,
  freeX: number,
  freeY: number,
): { x: number; y: number } {
  let fx = 0.5;
  let fy = 0.5;
  if (pos.includes("left")) fx = 0;
  else if (pos.includes("right")) fx = 1;
  if (pos.includes("top")) fy = 0;
  else if (pos.includes("bottom")) fy = 1;
  if (pos === "center") {
    fx = 0.5;
    fy = 0.5;
  }
  return { x: freeX * fx, y: freeY * fy };
}

function normalizeCorners(c: number | number[]): number[] {
  if (typeof c === "number") return [c, c, c, c];
  if (c.length === 1) return [c[0] ?? 0, c[0] ?? 0, c[0] ?? 0, c[0] ?? 0];
  if (c.length === 2) return [c[0] ?? 0, c[1] ?? 0, c[0] ?? 0, c[1] ?? 0];
  return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 0];
}

function roundRectPath(
  ctx: Konva.Context | CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number[],
): void {
  const [tl, tr, br, bl] = r;
  ctx.beginPath();
  ctx.moveTo(x + (tl ?? 0), y);
  ctx.lineTo(x + w - (tr ?? 0), y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + (tr ?? 0));
  ctx.lineTo(x + w, y + h - (br ?? 0));
  ctx.quadraticCurveTo(x + w, y + h, x + w - (br ?? 0), y + h);
  ctx.lineTo(x + (bl ?? 0), y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - (bl ?? 0));
  ctx.lineTo(x, y + (tl ?? 0));
  ctx.quadraticCurveTo(x, y, x + (tl ?? 0), y);
  ctx.closePath();
}
