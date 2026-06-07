import { type TemplateResult, html } from "lit";
import { KmControl } from "./base.js";
import { icon } from "./icons.js";
import type { PlayerApi } from "./player-api.js";

/** Toggles the player in and out of fullscreen. */
export class KmPlayerFullscreenButton extends KmControl {
  protected override bind(api: PlayerApi): void {
    this.watch(api.state.fullscreen);
  }

  protected override render(): TemplateResult {
    const fs = this.api?.state.fullscreen.get() ?? false;
    const label = fs ? "Exit fullscreen" : "Fullscreen";
    return html`<button
      type="button"
      class="km-player__btn"
      aria-label=${label}
      title=${label}
      @click=${() => this.api?.toggleFullscreen()}
    >${icon(fs ? "fullscreenExit" : "fullscreen")}</button>`;
  }
}

if (!customElements.get("km-player-fullscreen-button")) {
  customElements.define("km-player-fullscreen-button", KmPlayerFullscreenButton);
}
