import { SmooveContainer } from "./base.js";

/**
 * Layout containers. Each is a bare custom element that preserves its
 * user-authored children and is styled entirely by the opt-in stylesheet.
 *
 * - `<smoove-player-overlay>`   — centered overlay layer above the video.
 * - `<smoove-player-controls>`  — the control bar (one or more rows).
 * - `<smoove-player-controls-row>` — a flex row of controls.
 * - `<smoove-player-space grow>` — a spacer; `grow` makes it consume free space.
 */
export class SmoovePlayerOverlay extends SmooveContainer {}
export class SmoovePlayerControls extends SmooveContainer {}
export class SmoovePlayerControlsRow extends SmooveContainer {}
export class SmoovePlayerSpace extends SmooveContainer {}

const REGISTRY: Array<[string, CustomElementConstructor]> = [
  ["smoove-player-overlay", SmoovePlayerOverlay],
  ["smoove-player-controls", SmoovePlayerControls],
  ["smoove-player-controls-row", SmoovePlayerControlsRow],
  ["smoove-player-space", SmoovePlayerSpace],
];

for (const [tag, ctor] of REGISTRY) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}
