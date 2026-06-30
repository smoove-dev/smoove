import { type TemplateResult, html } from "lit";
import { SmooveControl } from "./base.js";
import type { PlayerApi } from "./player-api.js";

const fmt = (seconds: number): string => {
  const t = Math.max(0, seconds);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

/** Current time / total duration readout (`m:ss / m:ss`). */
export class SmoovePlayerTime extends SmooveControl {
  protected override bind(api: PlayerApi): void {
    this.watch(api.state.frame);
    this.watch(api.state.duration);
  }

  protected override render(): TemplateResult {
    const fps = this.api?.fps ?? 0;
    const frame = this.api?.state.frame.get() ?? 0;
    const total = this.api?.state.duration.get() ?? 0;
    const cur = fps > 0 ? frame / fps : 0;
    const dur = fps > 0 ? total / fps : 0;
    return html`<span class="km-player__time"
      ><span class="km-player__time-cur">${fmt(cur)}</span
      ><span class="km-player__time-sep">/</span
      ><span class="km-player__time-dur">${fmt(dur)}</span></span
    >`;
  }
}

if (!customElements.get("km-player-time")) {
  customElements.define("km-player-time", SmoovePlayerTime);
}
