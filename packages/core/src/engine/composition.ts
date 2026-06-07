import Konva from "konva";
import type { AudioAsset } from "../media/audio/asset.js";
import { type AudioChannel, AudioMixer } from "../media/audio/mixer.js";
import { MEDIA_MARK } from "../media/media-marker.js";
import { type Emitter, createEmitter } from "./emitter.js";
import { type Environment, type EnvironmentMode, detectEnvironment } from "./environment.js";
import { Sequence } from "./sequence.js";
import { type ReadonlySignal, type Signal, createSignal, derived } from "./signal.js";

export type CompositionOptions = Konva.StageConfig & {
  id: string;
  fps: number;
  durationInFrames: number;
  loop?: boolean;
  /** Force the runtime environment. Defaults to ambient detection (see `detectEnvironment`). */
  mode?: EnvironmentMode;
};

export type CompositionEvent = {
  frame: number;
  durationInFrames: number;
};

export type CompositionEventMap = {
  play: CompositionEvent;
  stop: CompositionEvent;
  time: CompositionEvent;
};

export type CompositionEventName = keyof CompositionEventMap;

const COMP_EVENTS: ReadonlySet<string> = new Set(["play", "stop", "time"]);
const isCompositionEvent = (e: string): e is CompositionEventName => COMP_EVENTS.has(e);

const raf: ((cb: (now: number) => void) => number) | null =
  typeof globalThis.requestAnimationFrame === "function"
    ? globalThis.requestAnimationFrame.bind(globalThis)
    : null;
const caf: ((id: number) => void) | null =
  typeof globalThis.cancelAnimationFrame === "function"
    ? globalThis.cancelAnimationFrame.bind(globalThis)
    : null;
const wallNow = (): number =>
  typeof globalThis.performance?.now === "function" ? globalThis.performance.now() : Date.now();

type CompositionMarker = { __KonvaMotionComposition?: Composition };

export function getComposition(stage: Konva.Stage): Composition | null {
  return (stage as Konva.Stage & CompositionMarker).__KonvaMotionComposition ?? null;
}

export class Composition extends Konva.Stage {
  readonly fps: number;
  readonly environment: Environment;
  /** Composition-level audio bus — master volume/mute scaling every Video and Audio. */
  readonly mixer = new AudioMixer();
  readonly frame: ReadonlySignal<number>;
  readonly isPlaying: ReadonlySignal<boolean>;
  readonly durationInFrames: ReadonlySignal<number>;
  readonly isStopped: ReadonlySignal<boolean>;
  readonly isPaused: ReadonlySignal<boolean>;
  readonly loop: ReadonlySignal<boolean>;
  /** Playback speed multiplier. 1 = realtime; negative plays in reverse. */
  readonly playbackRate: ReadonlySignal<number>;

  private readonly _frame: Signal<number>;
  private readonly _isPlaying: Signal<boolean>;
  private readonly _durationInFrames: Signal<number>;
  private readonly _loop: Signal<boolean>;
  private readonly _playbackRate: Signal<number>;
  private readonly _emitter: Emitter<CompositionEventMap>;

  private _rafId: number | null = null;
  private _startWallMs = 0;
  private _startFrame = 0;

  // delayRender/continueRender gate — outstanding async work that must complete
  // before a rendered frame is captured (Remotion's delayRender model).
  private readonly _renderHandles = new Set<number>();
  private _nextHandle = 0;
  private _renderWaiters: Array<() => void> = [];

  // Audio samples collected during offline rendering (one per Audio per frame),
  // for an external audio-mux pass. Empty during preview.
  private _audioAssets: AudioAsset[] = [];

  constructor(opts: CompositionOptions) {
    if (!opts.id) throw new Error("Composition: id is required");
    if (!Number.isFinite(opts.fps) || opts.fps <= 0) {
      throw new Error("Composition: fps must be a positive number");
    }
    if (!Number.isInteger(opts.durationInFrames) || opts.durationInFrames <= 0) {
      throw new Error("Composition: durationInFrames must be a positive integer");
    }

    const { fps, durationInFrames, loop = false, mode, ...stageOpts } = opts;
    // Konva requires a container element. In the browser, fall back to a
    // detached <div> when none is given, so a Composition can be constructed
    // up-front and mounted later via `setContainer` (e.g. handed to a player).
    // In non-browser runtimes (server rendering) there's no DOM, so leave it
    // unset — frames are driven with `setFrame`/`renderFrame`, not a canvas.
    if (stageOpts.container == null && typeof document !== "undefined") {
      stageOpts.container = document.createElement("div");
    }
    super(stageOpts);

    const marker = this as Konva.Stage & CompositionMarker;
    if (marker.__KonvaMotionComposition) {
      throw new Error("A Composition is already attached to this Stage.");
    }
    marker.__KonvaMotionComposition = this;

    this.fps = fps;
    this.environment = detectEnvironment(mode);

    this._frame = createSignal(0);
    this._isPlaying = createSignal(false);
    this._durationInFrames = createSignal(durationInFrames);
    this._loop = createSignal(loop);
    this._playbackRate = createSignal(1);

    this.frame = this._frame;
    this.isPlaying = this._isPlaying;
    this.durationInFrames = this._durationInFrames;
    this.loop = this._loop;
    this.playbackRate = this._playbackRate;

    this.isStopped = derived(
      [this._isPlaying, this._frame],
      () => !this._isPlaying.get() && this._frame.get() === 0,
    );
    this.isPaused = derived(
      [this._isPlaying, this._frame],
      () => !this._isPlaying.get() && this._frame.get() > 0,
    );

    this._emitter = createEmitter<CompositionEventMap>();
  }

  // biome-ignore lint/suspicious/noExplicitAny: bridges Konva's typed event API with our composition events.
  override on(evtStr: any, handler: any): any {
    if (typeof evtStr === "string" && isCompositionEvent(evtStr)) {
      return this._emitter.on(evtStr, handler);
    }
    return super.on(evtStr, handler);
  }

  // biome-ignore lint/suspicious/noExplicitAny: see on() above.
  override off(evtStr?: any, handler?: any): any {
    if (typeof evtStr === "string" && isCompositionEvent(evtStr)) {
      if (handler) this._emitter.off(evtStr, handler);
      return this;
    }
    return super.off(evtStr, handler);
  }

  override add(layer: Konva.Layer, ...rest: Konva.Layer[]): this {
    super.add(layer, ...rest);
    const frame = this._frame.get();
    for (const l of [layer, ...rest]) {
      if (l instanceof Sequence) {
        // Register the sequence's media (video + audio) eagerly so mixer channels
        // exist before playback (lazy fallback lives in each node's _ensureDriver).
        for (const v of l.find((n: Konva.Node) => n.getAttr(MEDIA_MARK) === true)) {
          this.mixer.register(v as unknown as AudioChannel);
        }
        l._apply(frame);
      }
    }
    return this;
  }

  play(): void {
    if (!raf || !caf) {
      throw new Error(
        "Composition.play() requires requestAnimationFrame. In non-browser environments, drive playback with setFrame() instead.",
      );
    }
    if (this._isPlaying.get()) return;

    this._isPlaying.set(true);
    this._startFrame = this._frame.get();
    this._startWallMs = wallNow();

    this._applyFrame(this._frame.get(), false);
    this._emitter.emit("play", this._event());
    this._scheduleTick();
  }

  override destroy(): this {
    this._cancelTick();
    this._isPlaying.set(false);
    return super.destroy();
  }

  pause(): void {
    if (!this._isPlaying.get()) return;
    this._cancelTick();
    this._isPlaying.set(false);
  }

  stop(): void {
    this._cancelTick();
    if (this._isPlaying.get()) this._isPlaying.set(false);
    this._frame.set(0);
    this._applyFrame(0, false);
    this._emitter.emit("stop", this._event());
  }

  setLoop(value: boolean): void {
    this._loop.set(value);
  }

  /**
   * Set the playback speed multiplier. `1` is realtime; `2` is double speed;
   * negative values play in reverse. Clamped to `[-10, 10]`; `0` throws (it
   * would freeze the clock). Changing the rate mid-playback resyncs the clock
   * so the new speed takes effect from the current frame onward.
   */
  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate === 0) {
      throw new Error("Composition.setPlaybackRate(): rate must be a non-zero finite number");
    }
    const clamped = Math.max(-10, Math.min(10, rate));
    if (clamped === this._playbackRate.get()) return;
    this._playbackRate.set(clamped);
    if (this._isPlaying.get()) {
      this._startFrame = this._frame.get();
      this._startWallMs = wallNow();
    }
  }

  setFrame(target: number): void {
    const clamped = Math.max(0, Math.min(this._durationInFrames.get() - 1, Math.floor(target)));
    if (clamped === this._frame.get()) return;
    this._frame.set(clamped);
    if (this._isPlaying.get()) {
      this._startFrame = clamped;
      this._startWallMs = wallNow();
    }
    this._applyFrame(clamped, true);
  }

  /**
   * Re-apply the **current** frame to every sequence without advancing the
   * playhead — the engine's "re-render" hook. Call this after mutating external
   * state that updaters read (e.g. live-edited props) so the change shows
   * immediately while paused. Updaters re-run, `Flex`/`Block` re-layout, and
   * active sequences `batchDraw` — exactly like a normal tick at the same frame.
   */
  refresh(): void {
    this._applyFrame(this._frame.get(), false);
  }

  /**
   * Register an outstanding async task that must finish before the current
   * frame is considered fully rendered — Remotion's `delayRender`. Returns a
   * handle to clear with {@link continueRender}.
   */
  delayRender(_label?: string): number {
    const handle = this._nextHandle++;
    this._renderHandles.add(handle);
    return handle;
  }

  /** Clear a {@link delayRender} handle; resolves `renderFrame()` once all clear. */
  continueRender(handle: number): void {
    if (!this._renderHandles.delete(handle)) return;
    if (this._renderHandles.size === 0) {
      const waiters = this._renderWaiters;
      this._renderWaiters = [];
      for (const resolve of waiters) resolve();
    }
  }

  /**
   * Apply a frame and wait until all {@link delayRender} handles registered
   * during that application clear. This is the offline / server render
   * entrypoint — e.g. `for (f) { await comp.renderFrame(f); capture(); }`.
   */
  async renderFrame(target: number): Promise<void> {
    const clamped = Math.max(0, Math.min(this._durationInFrames.get() - 1, Math.floor(target)));
    this._frame.set(clamped);
    this._applyFrame(clamped, true);
    if (this._renderHandles.size === 0) return;
    await new Promise<void>((resolve) => {
      this._renderWaiters.push(resolve);
    });
  }

  /** @internal — {@link RenderingAudioDriver} records one sample per audio per frame. */
  _collectAudioAsset(asset: AudioAsset): void {
    this._audioAssets.push(asset);
  }

  /**
   * Audio samples collected during offline rendering — one per {@link Audio}
   * per rendered frame. Feed these to an external mux pass (e.g. ffmpeg) to
   * assemble the audio track. Empty during preview.
   */
  getAudioAssets(): AudioAsset[] {
    return [...this._audioAssets];
  }

  /** Reset the collected audio samples — call before re-rendering a range. */
  clearAudioAssets(): void {
    this._audioAssets = [];
  }

  private _event(): CompositionEvent {
    return {
      frame: this._frame.get(),
      durationInFrames: this._durationInFrames.get(),
    };
  }

  private _applyFrame(frame: number, emit: boolean): void {
    for (const child of this.getChildren()) {
      if (child instanceof Sequence) child._apply(frame);
    }
    if (emit) this._emitter.emit("time", this._event());
  }

  private _scheduleTick(): void {
    if (!raf) return;
    this._rafId = raf(this._tick);
  }

  private _cancelTick(): void {
    if (this._rafId !== null && caf) {
      caf(this._rafId);
      this._rafId = null;
    }
  }

  private _tick = (now: number): void => {
    if (!this._isPlaying.get()) return;
    const rate = this._playbackRate.get();
    const elapsedMs = now - this._startWallMs;
    // round (not floor) so small negative advances still register frame-by-frame.
    const advance = Math.round((elapsedMs / 1000) * this.fps * rate);
    const lastFrame = this._durationInFrames.get() - 1;
    const target = Math.max(0, Math.min(lastFrame, this._startFrame + advance));

    if (target !== this._frame.get()) {
      this._frame.set(target);
      this._applyFrame(target, true);
    }

    const atEnd = rate > 0 && target >= lastFrame;
    const atStart = rate < 0 && target <= 0;
    if (atEnd || atStart) {
      if (this._loop.get()) {
        const wrap = atEnd ? 0 : lastFrame;
        this._startFrame = wrap;
        this._startWallMs = now;
        this._frame.set(wrap);
        this._applyFrame(wrap, true);
        this._scheduleTick();
        return;
      }
      this._cancelTick();
      this._isPlaying.set(false);
      return;
    }

    this._scheduleTick();
  };
}
