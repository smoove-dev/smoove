import Konva from "konva";
import { getComposition } from "../../engine/composition.js";
import { detectEnvironment, getEnvironment } from "../../engine/environment.js";
import { getDefaultAudioSourceFactory } from "../../engine/runtime-defaults.js";
import { type ReadonlySignal, type Signal, createSignal } from "../../engine/signal.js";
import { AUDIO_MARK, MEDIA_MARK } from "../media-marker.js";
import type { MediaTiming } from "../media-time.js";
import type { AudioDriver, AudioDriverContext } from "./audio-driver.js";
import { PreviewAudioDriver } from "./audio-for-preview.js";
import { RenderingAudioDriver } from "./audio-for-rendering.js";
import type { AudioSource } from "./audio-source.js";
import type { AudioChannel, AudioMixer } from "./mixer.js";
import type { AudioConfig } from "./types.js";

/**
 * Timeline-driven audio. API mirrors Remotion's `<Audio>`
 * (`trimBefore`/`trimAfter`/`loop`/`muted`/`volume`/`playbackRate`). It is an
 * invisible {@link Konva.Group} so it lives in the `Sequence` tree and is
 * discovered, range-gated, ticked, and mixer-registered exactly like
 * {@link Video} — but it produces no pixels. Picks a {@link RenderingAudioDriver}
 * or {@link PreviewAudioDriver} based on the composition's {@link Environment}.
 */
export class Audio extends Konva.Group implements AudioChannel {
  /** Human label for mixer UIs — `config.name`, falling back to `config.src`. */
  readonly label: string;
  /** Intrinsic audio level, 0..1 — scaled by the composition mixer's master. */
  readonly volume: ReadonlySignal<number>;
  readonly muted: ReadonlySignal<boolean>;

  private readonly _src: string;
  private readonly _source: AudioSource;
  private readonly _trimBefore: number;
  private readonly _trimAfter?: number;
  private readonly _loop: boolean;
  private readonly _playbackRate: number;
  private readonly _volume: Signal<number>;
  private readonly _muted: Signal<boolean>;
  private _mixer: AudioMixer | null = null;
  private _driver: AudioDriver | null = null;

  constructor(config: AudioConfig) {
    super({ listening: false, visible: false, id: config.id });
    this.setAttr(MEDIA_MARK, true);
    this.setAttr(AUDIO_MARK, true);

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

    // Build the source eagerly so loading starts immediately. The driver (which
    // needs the attached stage's composition) is resolved lazily on first tick.
    const env = detectEnvironment();
    const factory = config.sourceFactory ?? getDefaultAudioSourceFactory();
    this._source = factory(env);
    this._applyAudio(); // honor config volume/muted before a mixer is attached
    this._source.setPlaybackRate(this._playbackRate);
    this._source.load(config.src).catch((err: unknown) => {
      console.error("[smoove] Audio load failed:", err);
    });
  }

  /** @internal — called by Sequence on each tick while this audio is on-stage. */
  _kmTick(localFrame: number): void {
    const driver = this._ensureDriver();
    driver?.tick(localFrame);
  }

  /** @internal — called by Sequence when it goes out of range. */
  _kmDeactivate(): void {
    this._driver?.deactivate();
  }

  private _ensureDriver(): AudioDriver | null {
    if (this._driver) return this._driver;
    const stage = this.getStage();
    if (!stage) return null;
    const comp = getComposition(stage);
    if (!comp) return null;

    // Lazy fallback for audio added after its sequence was registered.
    comp.mixer.register(this);

    const timing: MediaTiming = {
      fps: comp.fps,
      trimBefore: this._trimBefore,
      trimAfter: this._trimAfter,
      loop: this._loop,
      playbackRate: this._playbackRate,
    };
    const ctx: AudioDriverContext = {
      source: this._source,
      timing,
      comp,
      id: this.id() || `audio-${this._id}`,
      src: this._src,
      effectiveVolume: () => {
        const m = this._mixer;
        const master = m ? m.volume.get() : 1;
        return master * this._volume.get();
      },
      effectiveMuted: () => {
        const m = this._mixer;
        const masterMuted = m ? m.muted.get() : false;
        return masterMuted || this._muted.get();
      },
    };
    this._driver = getEnvironment(stage).isRendering
      ? new RenderingAudioDriver(ctx)
      : new PreviewAudioDriver(ctx);
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
}

export function isAudioNode(node: Konva.Node): node is Audio {
  return node.getAttr(AUDIO_MARK) === true;
}
