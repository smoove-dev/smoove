import { KmContainer } from "./base.js";

/**
 * Layout containers. Each is a bare custom element that preserves its
 * user-authored children and is styled entirely by the opt-in stylesheet.
 *
 * - `<km-player-overlay>`   — centered overlay layer above the video.
 * - `<km-player-controls>`  — the control bar (one or more rows).
 * - `<km-player-controls-row>` — a flex row of controls.
 * - `<km-player-space grow>` — a spacer; `grow` makes it consume free space.
 */
export class KmPlayerOverlay extends KmContainer {}
export class KmPlayerControls extends KmContainer {}
export class KmPlayerControlsRow extends KmContainer {}
export class KmPlayerSpace extends KmContainer {}

const REGISTRY: Array<[string, CustomElementConstructor]> = [
  ["km-player-overlay", KmPlayerOverlay],
  ["km-player-controls", KmPlayerControls],
  ["km-player-controls-row", KmPlayerControlsRow],
  ["km-player-space", KmPlayerSpace],
];

for (const [tag, ctor] of REGISTRY) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}
