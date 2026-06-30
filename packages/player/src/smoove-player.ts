import { ContextProvider } from "@lit/context";
import type { Composition } from "@smoove/core";
import { playerContext } from "./context.js";
import { createDefaultControls } from "./default-controls.js";
import type { PlayerApi, PlayerState } from "./player-api.js";
import { createSignal, type Signal } from "./signal.js";

const TIMEUPDATE_INTERVAL_MS = 250;
const now = (): number => (typeof performance?.now === "function" ? performance.now() : Date.now());

/**
 * Duck-typed `Composition` check — avoids a runtime dependency on `core`
 * (it stays a type-only import). A Composition is a `Konva.Stage`
 * (`setContainer`) that also exposes the engine's `refresh()`.
 */
function isComposition(v: unknown): v is Composition {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { setContainer?: unknown }).setContainer === "function" &&
    typeof (v as { refresh?: unknown }).refresh === "function"
  );
}

/**
 * Resolve a remote module's default export to a live {@link Composition},
 * unwrapping factories (sync/async) and `{ default }` nesting along the way.
 */
async function resolveComposition(input: unknown): Promise<Composition> {
  let value: unknown = input;
  for (let i = 0; i < 5; i++) {
    value = await value;
    if (isComposition(value)) return value;
    if (typeof value === "function") {
      value = (value as () => unknown)();
      continue;
    }
    if (typeof value === "object" && value !== null && "default" in value) {
      value = (value as { default: unknown }).default;
      continue;
    }
    break;
  }
  throw new Error(
    "[smoove] remote src did not resolve to a Composition — expected a default export of a Composition or a factory returning one",
  );
}

/**
 * `<smoove-player>` — the host element. Wraps a {@link Composition} and plays it
 * like an HTML5 `<video>`: letterbox-scales the stage to its box, supports
 * fullscreen and keyboard control, auto-renders a default control bar, and
 * exposes a Remotion-style imperative + event API.
 *
 * It is a plain custom element (not a `LitElement`) so it never re-renders over
 * its user-authored children (overlay / controls). Chrome is injected
 * imperatively; descendant controls read state through {@link PlayerApi}.
 *
 * `composition` is a property (an object), e.g. `el.composition = comp`.
 */
export class SmoovePlayer extends HTMLElement implements PlayerApi {
  static get observedAttributes(): string[] {
    return ["loop", "controls", "muted", "volume", "playbackrate", "src"];
  }

  // --- stable, player-owned reactive state -----------------------------------
  private readonly _frame = createSignal(0);
  private readonly _playing = createSignal(false);
  private readonly _duration = createSignal(1);
  private readonly _loop = createSignal(false);
  private readonly _rate = createSignal(1);
  private readonly _volume = createSignal(1);
  private readonly _muted = createSignal(false);
  private readonly _fullscreen = createSignal(false);
  private readonly _scale = createSignal(1);

  readonly state: PlayerState = {
    frame: this._frame,
    playing: this._playing,
    duration: this._duration,
    loop: this._loop,
    rate: this._rate,
    volume: this._volume,
    muted: this._muted,
    fullscreen: this._fullscreen,
    scale: this._scale,
  };

  private _comp: Composition | null = null;
  private _unsubs: Array<() => void> = [];
  // Monotonic token guarding async `src` loads: a stale import resolving late
  // must not clobber a composition assigned by a newer `src` (or imperatively).
  private _loadSeq = 0;
  private _prevPlaying = false;
  private _lastTimeupdate = 0;

  private _stage: HTMLDivElement | null = null;
  private _scaleEl: HTMLDivElement | null = null;
  private _canvasEl: HTMLDivElement | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _mutationObserver: MutationObserver | null = null;
  private _provider: ContextProvider<typeof playerContext> | null = null;

  // --- public reactive accessors (PlayerApi) ---------------------------------
  get composition(): Composition | null {
    return this._comp;
  }
  set composition(c: Composition | null) {
    // An explicit assignment wins over any in-flight `src` load — invalidate it.
    this._loadSeq++;
    if (c === this._comp) return;
    // Halt the outgoing composition so it stops ticking + playing audio in the
    // background — it's a long-lived instance the consumer may reuse, so we
    // reset it to a clean stopped state (frame 0) rather than leave it running.
    this._comp?.stop();
    this._unbind();
    this._comp = c ?? null;
    if (this.isConnected && this._comp) this._mount();
  }

  get fps(): number {
    return this._comp?.fps ?? 0;
  }

  // --- convenience attribute-backed properties -------------------------------
  get loop(): boolean {
    return this.hasAttribute("loop");
  }
  set loop(v: boolean) {
    this.toggleAttribute("loop", v);
  }
  get controls(): boolean {
    return this.hasAttribute("controls");
  }
  set controls(v: boolean) {
    this.toggleAttribute("controls", v);
  }
  get autoPlay(): boolean {
    return this.hasAttribute("autoplay");
  }
  set autoPlay(v: boolean) {
    this.toggleAttribute("autoplay", v);
  }
  get clickToPlay(): boolean {
    return !this.hasAttribute("no-click-to-play");
  }
  get spaceKey(): boolean {
    return !this.hasAttribute("no-space-key");
  }
  get keyboard(): boolean {
    return !this.hasAttribute("no-keyboard");
  }
  get doubleClickFullscreen(): boolean {
    return this.hasAttribute("double-click-fullscreen");
  }
  get initialFrame(): number {
    const a = this.getAttribute("initialframe");
    return a == null ? 0 : Number(a);
  }
  get src(): string | null {
    return this.getAttribute("src");
  }
  set src(v: string | null) {
    if (v == null) this.removeAttribute("src");
    else this.setAttribute("src", v);
  }

  // --- lifecycle -------------------------------------------------------------
  connectedCallback(): void {
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    this._ensureChrome();

    this._provider ??= new ContextProvider(this, {
      context: playerContext,
      initialValue: this,
    });

    this._resizeObserver ??= new ResizeObserver(() => this._layout());
    this._resizeObserver.observe(this);

    this._mutationObserver ??= new MutationObserver(() => this._reconcileControls());
    this._mutationObserver.observe(this, { childList: true });

    document.addEventListener("fullscreenchange", this._onFullscreenChange);
    this.addEventListener("keydown", this._onKeyDown);

    if (this._comp) this._mount();
    // A composition assigned imperatively before connect wins; otherwise honor
    // a declarative `src`.
    else if (this.src) this._loadFromSrc(this.src);
    this._reconcileControls();
  }

  disconnectedCallback(): void {
    this._unbind();
    this._resizeObserver?.disconnect();
    this._mutationObserver?.disconnect();
    document.removeEventListener("fullscreenchange", this._onFullscreenChange);
    this.removeEventListener("keydown", this._onKeyDown);
    // Intentionally NOT destroying the composition — the consumer owns it.
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    // `src` is handled before the early-return below: it loads a composition
    // rather than configuring an existing one, so it must run even when none is
    // mounted yet.
    if (name === "src") {
      if (this.isConnected && value) this._loadFromSrc(value);
      return;
    }
    const comp = this._comp;
    if (!comp) return;
    switch (name) {
      case "loop":
        comp.setLoop(this.loop);
        break;
      case "muted":
        comp.mixer.setMuted(this.hasAttribute("muted"));
        break;
      case "volume":
        if (this.hasAttribute("volume")) comp.mixer.setVolume(Number(this.getAttribute("volume")));
        break;
      case "playbackrate":
        if (this.hasAttribute("playbackrate"))
          comp.setPlaybackRate(Number(this.getAttribute("playbackrate")));
        break;
      case "controls":
        this._reconcileControls();
        break;
    }
  }

  // --- chrome / mounting -----------------------------------------------------
  private _ensureChrome(): void {
    if (this._stage) return;
    // Essential structural styles are applied inline so the player works with
    // zero CSS imported (headless). The opt-in stylesheet only adds cosmetics
    // (control bar, colors, overlay). The host needs a positioning context for
    // the absolutely-positioned stage; only set it if the page hasn't.
    if (getComputedStyle(this).position === "static") this.style.position = "relative";
    const stage = document.createElement("div");
    stage.className = "smoove-player__stage";
    stage.style.cssText = "position:absolute;inset:0;overflow:hidden";
    const scale = document.createElement("div");
    scale.className = "smoove-player__scale";
    scale.style.cssText = "position:absolute;top:0;left:0;transform-origin:top left";
    const canvas = document.createElement("div");
    canvas.className = "smoove-player__canvas";
    canvas.style.cssText = "width:100%;height:100%";
    scale.appendChild(canvas);
    stage.appendChild(scale);
    this.insertBefore(stage, this.firstChild);
    this._stage = stage;
    this._scaleEl = scale;
    this._canvasEl = canvas;
    stage.addEventListener("click", this._onStageClick);
    stage.addEventListener("dblclick", this._onStageDblClick);
  }

  private _mount(): void {
    const comp = this._comp;
    if (!comp) return;
    this._ensureChrome();
    if (!this._canvasEl) return;

    this._canvasEl.replaceChildren();
    comp.setContainer(this._canvasEl);

    // apply element config onto the composition
    if (this.hasAttribute("loop")) comp.setLoop(true);
    if (this.hasAttribute("muted")) comp.mixer.setMuted(true);
    if (this.hasAttribute("volume")) comp.mixer.setVolume(Number(this.getAttribute("volume")));
    if (this.hasAttribute("playbackrate"))
      comp.setPlaybackRate(Number(this.getAttribute("playbackrate")));

    // seed stable signals from the live composition
    this._frame.set(comp.frame.get());
    this._playing.set(comp.isPlaying.get());
    this._duration.set(comp.durationInFrames.get());
    this._loop.set(comp.loop.get());
    this._rate.set(comp.playbackRate.get());
    this._volume.set(comp.mixer.volume.get());
    this._muted.set(comp.mixer.muted.get());
    this._prevPlaying = comp.isPlaying.get();

    this._bind(comp);

    // Load at the start (or an explicit `initialframe`) — a reused composition
    // instance may carry a playhead from a previous mount.
    comp.setFrame(this.initialFrame);
    comp.refresh();
    this._layout();

    if (this.autoPlay) {
      try {
        this.play();
      } catch (error) {
        this._emit("error", { error });
      }
    }
  }

  private _bind(comp: Composition): void {
    this._unsubs.push(
      comp.frame.subscribe((frame) => {
        this._frame.set(frame);
        this._emit("frameupdate", { frame });
        const t = now();
        const last = comp.durationInFrames.get() - 1;
        if (t - this._lastTimeupdate >= TIMEUPDATE_INTERVAL_MS || frame >= last || frame <= 0) {
          this._lastTimeupdate = t;
          const fps = comp.fps;
          const total = comp.durationInFrames.get();
          this._emit("timeupdate", {
            frame,
            time: fps > 0 ? frame / fps : 0,
            durationInFrames: total,
            durationInSeconds: fps > 0 ? total / fps : 0,
          });
        }
      }),
      comp.isPlaying.subscribe((playing) => {
        this._playing.set(playing);
        const frame = comp.frame.get();
        if (playing && !this._prevPlaying) {
          this._emit("play", { frame });
        } else if (!playing && this._prevPlaying) {
          const last = comp.durationInFrames.get() - 1;
          const rate = comp.playbackRate.get();
          const ended =
            !comp.loop.get() && ((rate > 0 && frame >= last) || (rate < 0 && frame <= 0));
          this._emit(ended ? "ended" : "pause", { frame });
        }
        this._prevPlaying = playing;
      }),
      comp.durationInFrames.subscribe((d) => this._duration.set(d)),
      comp.loop.subscribe((l) => this._loop.set(l)),
      comp.playbackRate.subscribe((rate) => {
        this._rate.set(rate);
        this._emit("ratechange", { playbackRate: rate });
      }),
      comp.mixer.volume.subscribe((volume) => {
        this._volume.set(volume);
        this._emit("volumechange", { volume });
      }),
      comp.mixer.muted.subscribe((muted) => {
        this._muted.set(muted);
        this._emit("mutechange", { muted });
      }),
    );
  }

  private _unbind(): void {
    for (const u of this._unsubs) u();
    this._unsubs = [];
  }

  // --- remote loading --------------------------------------------------------
  /**
   * Dynamically import a remote ESM module and mount its default export. The
   * default export may be a {@link Composition}, a factory returning one (sync
   * or async), or a factory resolving to `{ default: Composition }`.
   *
   * Loads are race-guarded with {@link _loadSeq}: a stale import resolving after
   * a newer `src` — or an imperative `composition =` — is discarded.
   */
  private async _loadFromSrc(rawSrc: string): Promise<void> {
    const seq = ++this._loadSeq;
    let url: string;
    try {
      // Resolve against the document base so consumer-relative URLs behave like
      // `<video src>` (a bare dynamic import resolves relative to this module).
      url = new URL(rawSrc, document.baseURI).href;
    } catch (error) {
      this._emit("error", { error });
      return;
    }
    this.toggleAttribute("loading", true);
    this._emit("loadstart", { src: url });
    try {
      const mod = (await import(/* @vite-ignore */ url)) as { default?: unknown };
      const comp = await resolveComposition("default" in mod ? mod.default : mod);
      if (seq !== this._loadSeq) return; // superseded by a newer load/assignment
      this.toggleAttribute("loading", false);
      this.composition = comp;
      this._emit("loaded", { src: url, composition: comp });
    } catch (error) {
      if (seq !== this._loadSeq) return;
      this.toggleAttribute("loading", false);
      this._emit("error", { error });
    }
  }

  // --- layout / fullscreen ---------------------------------------------------
  private _layout(): void {
    const comp = this._comp;
    if (!comp || !this._scaleEl) return;
    const boxW = this.clientWidth;
    const boxH = this.clientHeight;
    const compW = comp.width() || 1;
    const compH = comp.height() || 1;
    if (boxW <= 0 || boxH <= 0) return;
    const scale = Math.min(boxW / compW, boxH / compH);
    const offX = (boxW - compW * scale) / 2;
    const offY = (boxH - compH * scale) / 2;
    this._scaleEl.style.width = `${compW}px`;
    this._scaleEl.style.height = `${compH}px`;
    this._scaleEl.style.transform = `translate(${offX}px, ${offY}px) scale(${scale})`;
    if (scale !== this._scale.get()) {
      this._scale.set(scale);
      this._emit("scalechange", { scale });
    }
  }

  private _onFullscreenChange = (): void => {
    const fs = document.fullscreenElement === this;
    this._fullscreen.set(fs);
    this.toggleAttribute("fullscreen", fs);
    this._emit("fullscreenchange", { isFullscreen: fs });
    this._layout();
  };

  // --- interaction -----------------------------------------------------------
  private _onStageClick = (): void => {
    if (this.clickToPlay) this.toggle();
  };

  private _onStageDblClick = (): void => {
    if (this.doubleClickFullscreen) this.toggleFullscreen();
  };

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (!this.keyboard) return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    switch (e.key) {
      case " ":
        if (this.spaceKey) {
          e.preventDefault();
          this.toggle();
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.stepBy(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        this.stepBy(1);
        break;
      case "f":
      case "F":
        this.toggleFullscreen();
        break;
      case "l":
      case "L":
        this.toggleLoop();
        break;
    }
  };

  private _reconcileControls(): void {
    if (!this.isConnected) return;
    const hasUserControls = Array.from(this.children).some(
      (c) => c.tagName === "SMOOVE-PLAYER-CONTROLS" && !c.hasAttribute("data-smoove-default"),
    );
    const existingDefault = this.querySelector(
      ":scope > smoove-player-controls[data-smoove-default]",
    );
    if (this.controls && !hasUserControls) {
      if (!existingDefault) this.appendChild(createDefaultControls());
    } else if (existingDefault) {
      existingDefault.remove();
    }
  }

  private _emit(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  // --- imperative API (PlayerApi) --------------------------------------------
  play(): void {
    const comp = this._comp;
    if (!comp) return;
    // Reverse playback from the start would immediately stop — jump to the end.
    if (comp.playbackRate.get() < 0 && comp.frame.get() <= 0) {
      comp.setFrame(comp.durationInFrames.get() - 1);
    }
    try {
      comp.play();
    } catch (error) {
      this._emit("error", { error });
    }
  }

  pause(): void {
    this._comp?.pause();
  }

  toggle(): void {
    if (this.isPlaying()) this.pause();
    else this.play();
  }

  stop(): void {
    this._comp?.stop();
  }

  seekTo(frame: number): void {
    const comp = this._comp;
    if (!comp) return;
    comp.setFrame(frame);
    this._emit("seeked", { frame: comp.frame.get() });
  }

  stepBy(delta: number): void {
    const comp = this._comp;
    if (!comp) return;
    this.seekTo(comp.frame.get() + delta);
  }

  setProps(props: Record<string, unknown>): void {
    this._comp?.setProps(props);
  }

  getCurrentFrame(): number {
    return this._comp?.frame.get() ?? 0;
  }

  isPlaying(): boolean {
    return this._comp?.isPlaying.get() ?? false;
  }

  setVolume(volume: number): void {
    this._comp?.mixer.setVolume(volume);
  }

  getVolume(): number {
    return this._comp?.mixer.volume.get() ?? this._volume.get();
  }

  mute(): void {
    this._comp?.mixer.setMuted(true);
  }

  unmute(): void {
    this._comp?.mixer.setMuted(false);
  }

  setMuted(muted: boolean): void {
    this._comp?.mixer.setMuted(muted);
  }

  toggleMute(): void {
    this._comp?.mixer.setMuted(!this.isMuted());
  }

  isMuted(): boolean {
    return this._comp?.mixer.muted.get() ?? this._muted.get();
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
    this._comp?.setLoop(loop);
  }

  toggleLoop(): void {
    this.setLoop(!this.isLooping());
  }

  isLooping(): boolean {
    return this._comp?.loop.get() ?? this._loop.get();
  }

  setPlaybackRate(rate: number): void {
    this._comp?.setPlaybackRate(rate);
  }

  getPlaybackRate(): number {
    return this._comp?.playbackRate.get() ?? this._rate.get();
  }

  override requestFullscreen(options?: FullscreenOptions): Promise<void> {
    return HTMLElement.prototype.requestFullscreen.call(this, options);
  }

  exitFullscreen(): Promise<void> {
    return this.isFullscreen() ? document.exitFullscreen() : Promise.resolve();
  }

  toggleFullscreen(): void {
    if (this.isFullscreen()) void this.exitFullscreen();
    else void this.requestFullscreen();
  }

  isFullscreen(): boolean {
    return document.fullscreenElement === this;
  }

  getScale(): number {
    return this._scale.get();
  }
}

if (!customElements.get("smoove-player")) {
  customElements.define("smoove-player", SmoovePlayer);
}
