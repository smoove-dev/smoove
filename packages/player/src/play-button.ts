import { type PropertyValues, type TemplateResult, html } from "lit";
import { SmooveControl } from "./base.js";
import { icon } from "./icons.js";
import type { PlayerApi } from "./player-api.js";

const SIZES: Record<string, number> = { small: 28, medium: 44, large: 72 };

/**
 * A large, centered play affordance (for use inside `<smoove-player-overlay>`).
 * `size` is `small | medium | large`. Reflects a `playing` attribute so the
 * stylesheet can fade it out during playback.
 */
export class SmoovePlayerPlayButton extends SmooveControl {
  static override properties = {
    size: { type: String, reflect: true },
    playing: { type: Boolean, reflect: true },
  };
  declare size?: "small" | "medium" | "large";
  declare playing?: boolean;

  protected override bind(api: PlayerApi): void {
    this.watch(api.state.playing);
  }

  protected override willUpdate(_changed: PropertyValues): void {
    this.playing = this.api?.state.playing.get() ?? false;
  }

  protected override render(): TemplateResult {
    const playing = this.api?.state.playing.get() ?? false;
    const size = SIZES[this.size ?? "medium"] ?? SIZES.medium;
    const label = playing ? "Pause" : "Play";
    return html`<button
      type="button"
      class="smoove-player__overlay-play"
      aria-label=${label}
      title=${label}
      @click=${() => this.api?.toggle()}
    >${icon(playing ? "pause" : "play", size)}</button>`;
  }
}

if (!customElements.get("smoove-player-play-button")) {
  customElements.define("smoove-player-play-button", SmoovePlayerPlayButton);
}
