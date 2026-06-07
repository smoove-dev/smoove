import { type PropertyValues, type TemplateResult, html } from "lit";
import { KmControl } from "./base.js";
import { icon } from "./icons.js";
import type { PlayerApi } from "./player-api.js";

/** Toggles loop playback. Reflects an `on` attribute when looping. */
export class KmPlayerLoopButton extends KmControl {
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
      class="km-player__btn"
      aria-label="Loop"
      title="Loop"
      aria-pressed=${this.api?.state.loop.get() ? "true" : "false"}
      @click=${() => this.api?.toggleLoop()}
    >${icon("loop")}</button>`;
  }
}

if (!customElements.get("km-player-loop-button")) {
  customElements.define("km-player-loop-button", KmPlayerLoopButton);
}
