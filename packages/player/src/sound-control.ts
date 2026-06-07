import { type TemplateResult, html } from "lit";
import { KmControl } from "./base.js";
import { icon } from "./icons.js";
import type { PlayerApi } from "./player-api.js";

/**
 * Mute toggle + volume slider. With the `collapsed` attribute the slider is
 * hidden until the control is hovered/focused (styled by the stylesheet).
 */
export class KmPlayerSoundControl extends KmControl {
  static override properties = {
    collapsed: { type: Boolean, reflect: true },
  };
  declare collapsed?: boolean;

  protected override bind(api: PlayerApi): void {
    this.watch(api.state.volume);
    this.watch(api.state.muted);
  }

  private _onInput(e: Event): void {
    const v = Number((e.target as HTMLInputElement).value);
    this.api?.setVolume(v);
    this.api?.setMuted(v === 0);
  }

  protected override render(): TemplateResult {
    const muted = this.api?.state.muted.get() ?? false;
    const volume = this.api?.state.volume.get() ?? 1;
    const off = muted || volume === 0;
    const label = off ? "Unmute" : "Mute";
    return html`<div class="km-player__sound">
      <button
        type="button"
        class="km-player__btn"
        aria-label=${label}
        title=${label}
        @click=${() => this.api?.toggleMute()}
      >${icon(off ? "mute" : "volume")}</button>
      <input
        class="km-player__volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        aria-label="Volume"
        .value=${String(off ? 0 : volume)}
        @input=${(e: Event) => this._onInput(e)}
      />
    </div>`;
  }
}

if (!customElements.get("km-player-sound-control")) {
  customElements.define("km-player-sound-control", KmPlayerSoundControl);
}
