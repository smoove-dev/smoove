import type {
  AudioChannel,
  AudioMixer,
  AudioSource,
  AudioSourceFactory,
  MediaTiming,
} from "@smoove/core";
import {
  AUDIO_MARK,
  createSignal,
  detectEnvironment,
  type Environment,
  getComposition,
  getDefaultAudioSourceFactory,
  getEnvironment,
  getMediaTime,
  MEDIA_MARK,
  type ReadonlySignal,
  type Signal,
} from "@smoove/core";
import Konva from "konva";
import type { AudioDriver, AudioDriverContext } from "./audio-driver.js";
import { PreviewAudioDriver } from "./audio-for-preview.js";
import { RenderingAudioDriver } from "./audio-for-rendering.js";
import {
  type AudioEnvelope,
  buildEnvelope,
  envelopeBandsAt,
  envelopeNoveltyAt,
  envelopePeakAt,
  envelopeRmsAt,
  envelopeWaveform,
} from "./envelope.js";
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
  /** Intrinsic audio level (1 = unity, >1 amplifies) — scaled by the mixer's master. */
  readonly volume: ReadonlySignal<number>;
  readonly muted: ReadonlySignal<boolean>;

  private readonly _src: string;
  // Reassigned on suspend/resume, so not readonly; `!` = set via _acquireSource().
  private _source!: AudioSource;
  private readonly _env: Environment;
  private readonly _factory: AudioSourceFactory;
  private _suspended = false;
  private readonly _trimBefore: number;
  private readonly _trimAfter?: number;
  private readonly _loop: boolean;
  private readonly _playbackRate: number;
  private readonly _volume: Signal<number>;
  private readonly _muted: Signal<boolean>;
  private _mixer: AudioMixer | null = null;
  private _driver: AudioDriver | null = null;

  /** Decoded loudness envelope — `null` until `introspect` finishes decoding. */
  readonly envelope: ReadonlySignal<AudioEnvelope | null>;
  private readonly _envelope: Signal<AudioEnvelope | null>;
  private _envelopeLoad: Promise<void> | null = null;
  private _envelopeGated = false;

  constructor(config: AudioConfig) {
    super({ listening: false, visible: false, id: config.id });
    this.setAttr(MEDIA_MARK, true);
    this.setAttr(AUDIO_MARK, true);

    this._src = config.src;
    // A `trim` play-window is sugar over trimBefore/trimAfter: start → trimBefore,
    // start + play → trimAfter. It wins over the absolute props for what it sets.
    const win = config.trim;
    this._trimBefore = win?.start ?? config.trimBefore ?? config.startFrom ?? 0;
    this._trimAfter =
      win?.play !== undefined ? (win.start ?? 0) + win.play : (config.trimAfter ?? config.endAt);
    this._loop = config.loop ?? false;
    this._playbackRate = config.playbackRate ?? 1;

    this.label = config.name ?? config.src;
    this._volume = createSignal(Math.max(0, config.volume ?? 1));
    this._muted = createSignal(config.muted ?? false);
    this.volume = this._volume;
    this.muted = this._muted;

    this._envelope = createSignal<AudioEnvelope | null>(null);
    this.envelope = this._envelope;
    if (config.introspect) {
      const opts = config.introspect === true ? {} : config.introspect;
      this._envelopeLoad = buildEnvelope(config.src, opts)
        .then((env) => {
          this._envelope.set(env);
        })
        .catch((err: unknown) => {
          console.error("[smoove] Audio envelope decode failed:", err);
        });
    }

    // Build the source eagerly so loading starts immediately. The driver (which
    // needs the attached stage's composition) is resolved lazily on first tick.
    this._env = detectEnvironment();
    this._factory = config.sourceFactory ?? getDefaultAudioSourceFactory();
    this._acquireSource();
  }

  /**
   * Create the media source and start loading it. Called once at construction
   * and again by {@link _kmResume} after {@link _kmSuspend} dropped it.
   */
  private _acquireSource(): void {
    this._source = this._factory(this._env);
    this._applyAudio(); // honor config/mixer volume+muted before playback
    this._source.setPlaybackRate(this._playbackRate);
    this._source.load(this._src).catch((err: unknown) => {
      console.error("[smoove] Audio load failed:", err);
    });
  }

  /** @internal — {@link Composition.suspend}: drop the source to stop downloading/decoding. */
  _kmSuspend(): void {
    if (this._suspended) return;
    this._suspended = true;
    this._driver?.dispose();
    this._driver = null;
    this._source.destroy();
  }

  /** @internal — {@link Composition.resume}: re-acquire the dropped source. */
  _kmResume(): void {
    if (!this._suspended) return;
    this._suspended = false;
    this._acquireSource();
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

    // Envelope gate: block the first painted/rendered frame on the decode.
    // Preview uses the asset-buffer gate; render uses delayRender so
    // renderFrame() awaits it. Register once, on first driver resolution.
    if (this._envelopeLoad && !this._envelopeGated) {
      this._envelopeGated = true;
      if (getEnvironment(stage).isRendering) {
        const handle = comp.delayRender("audio-envelope");
        void this._envelopeLoad.finally(() => comp.continueRender(handle));
      } else {
        comp.registerAsset(this._envelopeLoad, "audio-envelope");
      }
    }

    const timing = this._timing(comp.fps);
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
    // No upper clamp: >1 amplifies (Web Audio GainNode in preview, mux gain on
    // render). Only guard against negative levels.
    this._volume.set(Math.max(0, volume));
    this._applyAudio();
  }

  /**
   * RMS loudness (0..1) of the clip's actual sound at a **local frame** (same
   * frame your sequence updater receives). Pre-fader: multiply by your
   * effective gain for a post-fader meter. Returns 0 until the envelope is
   * decoded (`introspect`) or when the frame maps outside the clip.
   */
  rmsAt(localFrame: number, opts?: { normalized?: boolean }): number {
    const ctx = this._introspectionContext();
    if (!ctx) return 0;
    const v = envelopeRmsAt(ctx.env, getMediaTime(localFrame, ctx.timing));
    return opts?.normalized && ctx.env.maxRms > 0 ? v / ctx.env.maxRms : v;
  }

  /**
   * Absolute sample peak (0..1) at a local frame. `holdFrames` extends the
   * reading to the max over the trailing window — the classic meter hold bar.
   */
  peakAt(localFrame: number, opts?: { holdFrames?: number; normalized?: boolean }): number {
    const ctx = this._introspectionContext();
    if (!ctx) return 0;
    const hold = Math.max(0, Math.floor(opts?.holdFrames ?? 0));
    let max = 0;
    for (let f = Math.max(0, localFrame - hold); f <= localFrame; f++) {
      const v = envelopePeakAt(ctx.env, getMediaTime(f, ctx.timing));
      if (v > max) max = v;
    }
    return opts?.normalized && ctx.env.maxPeak > 0 ? max / ctx.env.maxPeak : max;
  }

  /**
   * Static waveform outline (signed min/max per column) for the clip span
   * between two local frames — draw it once, it never changes with playback.
   */
  waveform(
    fromFrame: number,
    toFrame: number,
    buckets: number,
  ): { min: Float32Array; max: Float32Array } {
    const ctx = this._introspectionContext();
    if (!ctx) return { min: new Float32Array(buckets), max: new Float32Array(buckets) };
    return envelopeWaveform(
      ctx.env,
      getMediaTime(fromFrame, ctx.timing),
      getMediaTime(toFrame, ctx.timing),
      buckets,
    );
  }

  /**
   * Spectral band magnitudes (log-spaced, 40 Hz → Nyquist) at a local frame —
   * the data behind an EQ/spectrum visual. Requires `introspect: { bands: N }`;
   * returns an empty array otherwise, a zeroed array out of range.
   */
  bandsAt(localFrame: number): Float32Array {
    const ctx = this._introspectionContext();
    if (!ctx) return new Float32Array(0);
    return envelopeBandsAt(ctx.env, getMediaTime(localFrame, ctx.timing));
  }

  /**
   * Spectral-flux novelty (0..1, normalized over the clip) at a local frame —
   * spikes on onsets, useful for beat-synced motion. Requires bands.
   */
  noveltyAt(localFrame: number): number {
    const ctx = this._introspectionContext();
    if (!ctx) return 0;
    return envelopeNoveltyAt(ctx.env, getMediaTime(localFrame, ctx.timing));
  }

  /** Envelope + timing, or null while unattached / not yet decoded. */
  private _introspectionContext(): { env: AudioEnvelope; timing: MediaTiming } | null {
    const env = this._envelope.get();
    if (!env) return null;
    const stage = this.getStage();
    const comp = stage ? getComposition(stage) : null;
    if (!comp) return null;
    return { env, timing: this._timing(comp.fps) };
  }

  /** Resolved clip timing for a composition fps — shared by the driver and introspection. */
  private _timing(fps: number): MediaTiming {
    return {
      fps,
      trimBefore: this._trimBefore,
      trimAfter: this._trimAfter,
      loop: this._loop,
      playbackRate: this._playbackRate,
    };
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
