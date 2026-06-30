import { html, type PropertyValues, type TemplateResult } from "lit";
import { SmooveControl } from "./base.js";
import { icon } from "./icons.js";
import type { PlayerApi } from "./player-api.js";

/** Toggles loop playback. Reflects an `on` attribute when looping. */
export class SmoovePlayerLoopButton extends SmooveControl {
  static override properties = { on: { type: Boolean, reflect: true } };
  declare on?: boolean;

  protected override bind(api: PlayerApi): void {
    this.watch(api.state.loop);
  }

  protected override willUpdate(_changed: PropertyValues): void {
    this.on = this.api?.state.loop.get() ?? false;
  }

  protected override render(): TemplateResult {
    return html`<button
      type="button"
      class="smoove-player__btn"
      aria-label="Loop"
      title="Loop"
      aria-pressed=${this.api?.state.loop.get() ? "true" : "false"}
      @click=${() => this.api?.toggleLoop()}
    >${icon("loop")}</button>`;
  }
}

if (!customElements.get("smoove-player-loop-button")) {
  customElements.define("smoove-player-loop-button", SmoovePlayerLoopButton);
}
