import { type TemplateResult, html } from "lit";
import { KmControl } from "./base.js";
import { icon } from "./icons.js";
import type { PlayerApi } from "./player-api.js";

/** A play/pause toggle button reflecting and driving playback state. */
export class KmPlayerPlayToggleButton extends KmControl {
  protected override bind(api: PlayerApi): void {
    this.watch(api.state.playing);
  }

  protected override render(): TemplateResult {
    const playing = this.api?.state.playing.get() ?? false;
    const label = playing ? "Pause" : "Play";
    return html`<button
      type="button"
      class="km-player__btn"
      aria-label=${label}
      title=${label}
      @click=${() => this.api?.toggle()}
    >${icon(playing ? "pause" : "play")}</button>`;
  }
}

if (!customElements.get("km-player-play-toggle-button")) {
  customElements.define("km-player-play-toggle-button", KmPlayerPlayToggleButton);
}
