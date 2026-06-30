import { html, type TemplateResult } from "lit";
import { SmooveControl } from "./base.js";
import type { PlayerApi } from "./player-api.js";

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/**
 * Draggable seek bar. Mirrors the demo studio's scrubber UX: grabbing pauses
 * playback and resumes on release, dragging seeks live.
 */
export class SmoovePlayerProgress extends SmooveControl {
  private _dragging = false;
  private _wasPlaying = false;

  protected override bind(api: PlayerApi): void {
    this.watch(api.state.frame);
    this.watch(api.state.duration);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._teardownDrag();
  }

  private _pct(): number {
    const total = this.api?.state.duration.get() ?? 0;
    const frame = this.api?.state.frame.get() ?? 0;
    return total > 1 ? clamp01(frame / (total - 1)) : 0;
  }

  private _posFromEvent(e: PointerEvent): number {
    const track = this.querySelector(".smoove-player__track") ?? this;
    const r = track.getBoundingClientRect();
    return r.width > 0 ? clamp01((e.clientX - r.left) / r.width) : 0;
  }

  private _seek(p: number): void {
    const total = this.api?.state.duration.get() ?? 0;
    if (total > 1) this.api?.seekTo(Math.round(p * (total - 1)));
  }

  private _onMove = (e: PointerEvent): void => {
    if (this._dragging) this._seek(this._posFromEvent(e));
  };

  private _onUp = (): void => {
    if (!this._dragging) return;
    this._dragging = false;
    this._teardownDrag();
    if (this._wasPlaying) this.api?.play();
  };

  private _teardownDrag(): void {
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onUp);
  }

  private _onDown(e: PointerEvent): void {
    if (!this.api) return;
    e.preventDefault();
    this._dragging = true;
    this._wasPlaying = this.api.isPlaying();
    this.api.pause();
    this._seek(this._posFromEvent(e));
    window.addEventListener("pointermove", this._onMove);
    window.addEventListener("pointerup", this._onUp);
  }

  protected override render(): TemplateResult {
    const pct = this._pct() * 100;
    return html`<div
      class="smoove-player__progress${this._dragging ? " is-dragging" : ""}"
      @pointerdown=${(e: PointerEvent) => this._onDown(e)}
    >
      <div class="smoove-player__track">
        <div class="smoove-player__fill" style=${`width:${pct}%`}></div>
        <div class="smoove-player__knob" style=${`left:${pct}%`}></div>
      </div>
    </div>`;
  }
}

if (!customElements.get("smoove-player-progress")) {
  customElements.define("smoove-player-progress", SmoovePlayerProgress);
}
