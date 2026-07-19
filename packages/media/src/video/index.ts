import type {
  AudioChannel,
  AudioMixer,
  KMLayoutNode,
  LayoutBox,
  ObjectFit,
  ObjectPosition,
  SizeValue,
  VideoSource,
  VideoSourceFactory,
} from "@smoove/core";
import {
  applySize,
  createSignal,
  detectEnvironment,
  type Environment,
  type FlexilyNode,
  getComposition,
  getDefaultVideoSourceFactory,
  getEnvironment,
  MEDIA_MARK,
  type Measurement,
  type MeasureOptions,
  measure as measureNode,
  parseSize,
  type ReadonlySignal,
  type Signal,
  VIDEO_MARK,
} from "@smoove/core";
import Konva from "konva";
import type { AudioDriver, AudioDriverContext } from "../audio/audio-driver.js";
import { PreviewAudioDriver } from "../audio/audio-for-preview.js";
import { RenderingAudioDriver } from "../audio/audio-for-rendering.js";
import { isSchedulable } from "../audio/audio-source-mediabunny.js";
import type { VideoDriver, VideoDriverContext, VideoTiming } from "./driver.js";
import type { VideoConfig } from "./types.js";
import { PreviewVideoDriver } from "./video-for-preview.js";
import { RenderingVideoDriver } from "./video-for-rendering.js";

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
export class Video extends Konva.Group implements AudioChannel, KMLayoutNode {
  readonly _kmRole = "leaf" as const;
  /** Human label for mixer UIs — `config.name`, falling back to `config.src`. */
  readonly label: string;
  /** Intrinsic audio level, 0..1 — scaled by the composition mixer's master. */
  readonly volume: ReadonlySignal<number>;
  readonly muted: ReadonlySignal<boolean>;

  private readonly _img: Konva.Image;
  // Reassigned on suspend/resume, so not readonly; `!` = set via _acquireSource().
  private _source!: VideoSource;
  private readonly _env: Environment;
  private readonly _factory: VideoSourceFactory;
  private _suspended = false;
  private readonly _trimBefore: number;
  private readonly _trimAfter?: number;
  private readonly _loop: boolean;
  private readonly _playbackRate: number;
  private readonly _volume: Signal<number>;
  private readonly _muted: Signal<boolean>;
  private _mixer: AudioMixer | null = null;
  private _driver: VideoDriver | null = null;
  private _audioDriver: AudioDriver | null = null;
  private readonly _src: string;

  constructor(config: VideoConfig) {
    super(pickKonvaConfig(config));
    this.setAttr(MEDIA_MARK, true);
    this.setAttr(VIDEO_MARK, true);

    this._src = config.src;
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
    this._env = detectEnvironment();
    this._factory = config.sourceFactory ?? getDefaultVideoSourceFactory();
    this._acquireSource();

    this._layoutImage();
  }

  /**
   * Create the media source and start loading it. Called once at construction
   * and again by {@link _kmResume} after {@link _kmSuspend} dropped it.
   */
  private _acquireSource(): void {
    this._source = this._factory(this._env);
    this._applyAudio(); // honor config/mixer volume+muted before playback
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
    this._source.load(this._src).catch((err: unknown) => {
      console.error("[smoove] Video load failed:", err);
    });
  }

  /**
   * Escape hatch for advanced use: the live {@link VideoSource}. Narrow with
   * `source instanceof MediabunnyVideoSource` for its `.input` demuxer. The
   * node replaces this instance on suspend/resume, so read it fresh each time
   * rather than caching the reference.
   */
  get source(): VideoSource {
    return this._source;
  }

  /** @internal — {@link Composition.suspend}: drop the source to stop downloading/decoding. */
  _kmSuspend(): void {
    if (this._suspended) return;
    this._suspended = true;
    this._driver?.dispose();
    this._driver = null;
    this._audioDriver?.dispose();
    this._audioDriver = null;
    this._source.destroy();
    this._img.image(undefined);
    this.getLayer()?.batchDraw();
  }

  /** @internal — {@link Composition.resume}: re-acquire the dropped source. */
  _kmResume(): void {
    if (!this._suspended) return;
    this._suspended = false;
    this._acquireSource();
  }

  /** @internal — called by Sequence on each tick while this video is on-stage. */
  _kmTick(localFrame: number): void {
    const driver = this._ensureDriver();
    driver?.tick(localFrame);
    this._audioDriver?.tick(localFrame);
  }

  /** @internal — called by Sequence when it goes out of range. */
  _kmDeactivate(): void {
    this._driver?.deactivate();
    this._audioDriver?.deactivate();
  }

  /** @internal — {@link KMLayoutNode}: size from explicit width/height (cover/contain handle the rest). */
  _kmMeasure(node: FlexilyNode): void {
    applySize(
      node,
      this.attrs.flexWidth as SizeValue | undefined,
      this.attrs.flexHeight as SizeValue | undefined,
    );
  }

  /** @internal — {@link KMLayoutNode}: write the computed box back + re-fit the frame. */
  _kmPlace(box: LayoutBox): void {
    this.x(box.left);
    this.y(box.top);
    this.width(box.width);
    this.height(box.height);
    this._layoutImage();
  }

  /**
   * Measure this node's stage-space bounds — see {@link measureNode}. The
   * frame pass never ticks media, so measuring a `Video` reads its layout
   * box without seeking or decoding.
   */
  measure(opts?: MeasureOptions): Measurement {
    return measureNode(this, opts);
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
    if (getEnvironment(stage).isRendering) {
      this._driver = new RenderingVideoDriver(ctx);
      // Record the file's soundtrack as audio assets so the server mux can decode
      // and mix it (videos with no audio track simply yield no audible PCM).
      const audioCtx: AudioDriverContext = {
        source: this._source,
        timing,
        comp,
        id: this.id() || `video-${this._id}`,
        src: this._src,
        effectiveVolume: () => {
          const m = this._mixer;
          return (m ? m.volume.get() : 1) * this._volume.get();
        },
        effectiveMuted: () => {
          const m = this._mixer;
          return (m ? m.muted.get() : false) || this._muted.get();
        },
      };
      this._audioDriver = new RenderingAudioDriver(audioCtx);
    } else {
      this._driver = new PreviewVideoDriver(ctx);
      // In preview, schedule the file's own soundtrack through the shared Web
      // Audio context — same scheduler the standalone Audio node uses. (The
      // rendering branch above records it as audio assets for the server mux.)
      if (isSchedulable(this._source)) {
        const audioCtx: AudioDriverContext = {
          source: this._source,
          timing,
          comp,
          id: this.id() || `video-${this._id}`,
          src: this._src,
          effectiveVolume: () => {
            const m = this._mixer;
            return (m ? m.volume.get() : 1) * this._volume.get();
          },
          effectiveMuted: () => {
            const m = this._mixer;
            return (m ? m.muted.get() : false) || this._muted.get();
          },
        };
        this._audioDriver = new PreviewAudioDriver(audioCtx);
      }
    }
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
    this._audioDriver?.dispose();
    this._audioDriver = null;
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
