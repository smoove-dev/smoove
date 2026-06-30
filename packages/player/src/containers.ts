import { SmooveContainer } from "./base.js";

/**
 * Layout containers. Each is a bare custom element that preserves its
 * user-authored children and is styled entirely by the opt-in stylesheet.
 *
 * - `<km-player-overlay>`   — centered overlay layer above the video.
 * - `<km-player-controls>`  — the control bar (one or more rows).
 * - `<km-player-controls-row>` — a flex row of controls.
 * - `<km-player-space grow>` — a spacer; `grow` makes it consume free space.
 */
export class SmoovePlayerOverlay extends SmooveContainer {}
export class SmoovePlayerControls extends SmooveContainer {}
export class SmoovePlayerControlsRow extends SmooveContainer {}
export class SmoovePlayerSpace extends SmooveContainer {}

const REGISTRY: Array<[string, CustomElementConstructor]> = [
  ["km-player-overlay", SmoovePlayerOverlay],
  ["km-player-controls", SmoovePlayerControls],
  ["km-player-controls-row", SmoovePlayerControlsRow],
  ["km-player-space", SmoovePlayerSpace],
];

for (const [tag, ctor] of REGISTRY) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}
