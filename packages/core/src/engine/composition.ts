import Konva from "konva";
import type { AudioAsset } from "../media/audio/asset.js";
import { type AudioChannel, AudioMixer } from "../media/audio/mixer.js";
import { FONT_MARK, MEDIA_MARK } from "../media/media-marker.js";
import { createEmitter, type Emitter } from "./emitter.js";
import { detectEnvironment, type Environment, type EnvironmentMode } from "./environment.js";
import { Sequence, type SequenceProvider } from "./sequence.js";
import { createSignal, derived, type ReadonlySignal, type Signal } from "./signal.js";

/** A SequenceProvider duck-types on a `sequences()` method (Konva layers lack one). */
function isSequenceProvider(x: Konva.Layer | SequenceProvider): x is SequenceProvider {
  return typeof (x as Partial<SequenceProvider>).sequences === "function";
}

export type CompositionOptions<P extends Record<string, unknown> = Record<string, unknown>> =
  Konva.StageConfig & {
    id: string;
    fps: number;
    durationInFrames: number;
    loop?: boolean;
    /** Initial props handed to the scene. Read live with `comp.props.get()` in
        updaters; pushed to with `comp.setProps()` by a player or the studio. */
    props?: P;
    /** Force the runtime environment. Defaults to ambient detection (see `detectEnvironment`). */
    mode?: EnvironmentMode;
  };

export type CompositionEvent = {
  frame: number;
  durationInFrames: number;
};

/**
 * Asset-buffering state. `"idle"` — nothing pending; `"buffering"` — one or more
 * assets (fonts, …) are still loading; `"ready"` — everything registered so far
 * has settled. Observe it to show a spinner; `play()` honors it (see below).
 */
export type BufferState = "idle" | "buffering" | "ready";

/** A node that registers itself with the composition when discovered (e.g. {@link Font}). */
type RegisterableNode = Konva.Node & {
  // biome-ignore lint/suspicious/noExplicitAny: props-shape-agnostic, like the CompositionMarker.
  _kmRegister?: (comp: Composition<any>) => void;
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

// biome-ignore lint/suspicious/noExplicitAny: the marker is props-shape-agnostic; P is invariant via setProps.
type CompositionMarker = { __SmooveComposition?: Composition<any> };

export function getComposition(stage: Konva.Stage): Composition | null {
  return (stage as Konva.Stage & CompositionMarker).__SmooveComposition ?? null;
}

export class Composition<
  P extends Record<string, unknown> = Record<string, unknown>,
> extends Konva.Stage {
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
  /** Live props the scene reads. Pushed to with {@link setProps} by a player or
      the studio form; updaters read it via `comp.props.get()`. */
  readonly props: ReadonlySignal<P>;
  /** Asset-buffering state — `"idle"` | `"buffering"` | `"ready"`. See {@link registerAsset}. */
  readonly buffer: ReadonlySignal<BufferState>;
  /** Convenience: `buffer.get() === "buffering"`. */
  readonly isBuffering: ReadonlySignal<boolean>;

  private readonly _frame: Signal<number>;
  private readonly _props: Signal<P>;
  private readonly _isPlaying: Signal<boolean>;
  private readonly _durationInFrames: Signal<number>;
  private readonly _loop: Signal<boolean>;
  private readonly _playbackRate: Signal<number>;
  private readonly _buffer: Signal<BufferState>;
  private readonly _emitter: Emitter<CompositionEventMap>;

  private _rafId: number | null = null;
  private _startWallMs = 0;
  private _startFrame = 0;

  // Asset-buffering gate (the preview analogue of the delayRender render gate):
  // outstanding asset loads that should be ready before playback advances.
  private readonly _assets = new Set<Promise<unknown>>();
  private _readyWaiters: Array<() => void> = [];
  // Set when play() is called while buffering — playback starts on buffer ready.
  private _resumeOnReady = false;

  // delayRender/continueRender gate — outstanding async work that must complete
  // before a rendered frame is captured (Remotion's delayRender model).
  private readonly _renderHandles = new Set<number>();
  private _nextHandle = 0;
  private _renderWaiters: Array<() => void> = [];

  // Audio samples collected during offline rendering (one per Audio per frame),
  // for an external audio-mux pass. Empty during preview.
  private _audioAssets: AudioAsset[] = [];

  // Reused scratch canvas for captureCanvas() — avoids a per-frame skia Canvas
  // allocation (native memory V8's GC can't see) during long renders.
  private _captureCanvas: HTMLCanvasElement | null = null;

  constructor(opts: CompositionOptions<P>) {
    if (!opts.id) throw new Error("Composition: id is required");
    if (!Number.isFinite(opts.fps) || opts.fps <= 0) {
      throw new Error("Composition: fps must be a positive number");
    }
    if (!Number.isInteger(opts.durationInFrames) || opts.durationInFrames <= 0) {
      throw new Error("Composition: durationInFrames must be a positive integer");
    }

    const { fps, durationInFrames, loop = false, props, mode, ...stageOpts } = opts;
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
    if (marker.__SmooveComposition) {
      throw new Error("A Composition is already attached to this Stage.");
    }
    marker.__SmooveComposition = this;

    this.fps = fps;
    this.environment = detectEnvironment(mode);

    this._frame = createSignal(0);
    this._isPlaying = createSignal(false);
    this._durationInFrames = createSignal(durationInFrames);
    this._loop = createSignal(loop);
    this._playbackRate = createSignal(1);
    this._props = createSignal<P>(props ?? ({} as P));
    this._buffer = createSignal<BufferState>("idle");

    this.frame = this._frame;
    this.isPlaying = this._isPlaying;
    this.durationInFrames = this._durationInFrames;
    this.loop = this._loop;
    this.playbackRate = this._playbackRate;
    this.props = this._props;
    this.buffer = this._buffer;
    this.isBuffering = derived([this._buffer], () => this._buffer.get() === "buffering");

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

  override add(
    first: Konva.Layer | SequenceProvider,
    ...rest: (Konva.Layer | SequenceProvider)[]
  ): this {
    // Expand any SequenceProvider (Series / TransitionSeries) into its layers,
    // so `comp.add(series)` works as well as `comp.add(layer)`.
    const layers: Konva.Layer[] = [];
    for (const item of [first, ...rest]) {
      if (isSequenceProvider(item)) layers.push(...item.sequences());
      else layers.push(item);
    }
    if (layers.length === 0) return this;
    super.add(...(layers as [Konva.Layer, ...Konva.Layer[]]));
    const frame = this._frame.get();
    // Pass 1 — register assets first (across ALL added layers) so a Font in any
    // of them flips the buffer to "buffering" before we paint anything. Media is
    // registered eagerly so mixer channels exist before playback (lazy fallback
    // lives in each node's _ensureDriver / Font._kmTick).
    for (const l of layers) {
      if (l instanceof Sequence) {
        for (const v of l.find((n: Konva.Node) => n.getAttr(MEDIA_MARK) === true)) {
          this.mixer.register(v as unknown as AudioChannel);
        }
        for (const f of l.find((n: Konva.Node) => n.getAttr(FONT_MARK) === true)) {
          (f as RegisterableNode)._kmRegister?.(this);
        }
      }
    }
    // Pass 2 — paint the current frame, unless we're now buffering: leave the
    // sequences hidden (transparent) until assets load. The buffer-drain in
    // registerAsset paints the first frame once everything is ready.
    if (this._buffer.get() !== "buffering") {
      for (const l of layers) {
        if (l instanceof Sequence) l._apply(frame, true);
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
    // Buffer-aware: if assets are still loading, defer the clock and resume
    // automatically once buffering completes (see registerAsset).
    if (this._buffer.get() === "buffering") {
      this._resumeOnReady = true;
      return;
    }
    this._startClock();
  }

  private _startClock(): void {
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
    this._resumeOnReady = false;
    if (!this._isPlaying.get()) return;
    this._cancelTick();
    this._isPlaying.set(false);
  }

  stop(): void {
    this._resumeOnReady = false;
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
    // force: props/external state may have changed at the same frame, so the
    // sequence dedupe must not skip this re-apply.
    this._applyFrame(this._frame.get(), false, true);
  }

  /**
   * Replace the live props and re-render the current frame. Any holder — a bare
   * `<smoove-player>` or the studio form — drives the scene by calling this; the
   * `createSignal` `Object.is` guard skips a redundant refresh when nothing
   * changed. Pass an updater to derive the next value from the previous one.
   */
  setProps(next: P | ((prev: P) => P)): void {
    const value = typeof next === "function" ? (next as (prev: P) => P)(this._props.get()) : next;
    if (Object.is(value, this._props.get())) return;
    this._props.set(value);
    this.refresh();
  }

  /**
   * Register an outstanding asset load (e.g. a {@link Font}). While any asset is
   * pending, {@link buffer} is `"buffering"`; once all settle it flips to
   * `"ready"` and {@link whenReady} waiters resolve. A `play()` issued while
   * buffering is deferred and starts automatically here. Errors are swallowed
   * (the asset logs its own) so one bad asset can't wedge playback.
   *
   * This is the preview-side buffer; offline rendering uses the per-frame
   * {@link delayRender}/{@link renderFrame} gate instead.
   */
  registerAsset(load: Promise<unknown>, _label?: string): void {
    this._assets.add(load);
    if (this._buffer.get() !== "buffering") {
      this._buffer.set("buffering");
      // Hide everything so the stage is transparent while assets load — no frame
      // is shown over not-yet-loaded fonts.
      this._hideAllSequences();
    }
    const settle = (): void => {
      if (!this._assets.delete(load)) return;
      if (this._assets.size > 0) return;
      this._buffer.set("ready");
      const waiters = this._readyWaiters;
      this._readyWaiters = [];
      for (const resolve of waiters) resolve();
      // Now that assets are loaded, paint. If a play() was deferred, resume the
      // clock (which applies the frame); otherwise paint the current frame once.
      if (this._resumeOnReady) {
        this._resumeOnReady = false;
        this._startClock();
      } else {
        // force: first paint after assets settled, even though the frame is unchanged.
        this._applyFrame(this._frame.get(), false, true);
      }
    };
    load.then(settle, settle);
  }

  /** Resolves once no assets are pending — immediately if idle/ready. */
  whenReady(): Promise<void> {
    if (this._assets.size === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this._readyWaiters.push(resolve);
    });
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
    // force: offline render must apply every frame, even a re-rendered duplicate.
    this._applyFrame(clamped, true, true);
    if (this._renderHandles.size === 0) return;
    await new Promise<void>((resolve) => {
      this._renderWaiters.push(resolve);
    });
  }

  /**
   * Composite every visible sequence layer into a single canvas and return it.
   * Works headlessly (no DOM container needed); under the server skia backend
   * the result is a skia `Canvas`, on which a renderer can call
   * `.toBufferSync("raw")` for RGBA pixels.
   *
   * Unlike `Stage.toCanvas()`, this **reuses one scratch canvas** across calls.
   * Allocating a fresh skia `Canvas` per frame leaks native memory (invisible to
   * V8's GC), which balloons RSS and collapses throughput over a long render.
   */
  captureCanvas(): HTMLCanvasElement {
    const w = this.width();
    const h = this.height();
    let scratch = this._captureCanvas;
    if (!scratch) {
      scratch = Konva.Util.createCanvasElement();
      this._captureCanvas = scratch;
    }
    if (scratch.width !== w || scratch.height !== h) {
      scratch.width = w;
      scratch.height = h;
    }
    const ctx = scratch.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return scratch;
    ctx.clearRect(0, 0, w, h);
    for (const child of this.getChildren()) {
      if (child instanceof Konva.Layer && child.visible()) {
        // Force a synchronous scene draw so the layer's own canvas is current
        // (a `Sequence` may have only scheduled an async `batchDraw`).
        child.drawScene();
        ctx.drawImage(child.getNativeCanvasElement(), 0, 0, w, h);
      }
    }
    return scratch;
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

  private _applyFrame(frame: number, emit: boolean, force = false): void {
    // While buffering, draw nothing — the stage stays transparent until every
    // registered asset (fonts, …) has loaded. Sequences are left hidden so no
    // frame is painted over not-yet-loaded fonts. Offline rendering never
    // buffers (fonts gate via delayRender), so this only affects preview.
    if (this._buffer.get() === "buffering") return;
    for (const child of this.getChildren()) {
      if (child instanceof Sequence) child._apply(frame, force);
    }
    if (emit) this._emitter.emit("time", this._event());
  }

  /** Hide every sequence (transparent stage) — used while buffering assets. */
  private _hideAllSequences(): void {
    for (const child of this.getChildren()) {
      if (child instanceof Sequence) child._kmHide();
    }
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
