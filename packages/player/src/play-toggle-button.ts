import { html, type TemplateResult } from "lit";
import { SmooveControl } from "./base.js";
import { icon } from "./icons.js";
import type { PlayerApi } from "./player-api.js";

/** A play/pause toggle button reflecting and driving playback state. */
export class SmoovePlayerPlayToggleButton extends SmooveControl {
  protected override bind(api: PlayerApi): void {
    this.watch(api.state.playing);
  }

  protected override render(): TemplateResult {
    const playing = this.api?.state.playing.get() ?? false;
    const label = playing ? "Pause" : "Play";
    return html`<button
      type="button"
      class="smoove-player__btn"
      aria-label=${label}
      title=${label}
      @click=${() => this.api?.toggle()}
    >${icon(playing ? "pause" : "play")}</button>`;
  }
}

if (!customElements.get("smoove-player-play-toggle-button")) {
  customElements.define("smoove-player-play-toggle-button", SmoovePlayerPlayToggleButton);
}
