// Importing the control modules ensures their custom elements are defined
// before the default bar instantiates them.
import "./containers.js";
import "./progress.js";
import "./play-toggle-button.js";
import "./sound-control.js";
import "./time.js";
import "./loop-button.js";
import "./fullscreen-button.js";

/**
 * Build the default control bar used when `<km-player controls>` has no
 * user-supplied `<km-player-controls>`. It is composed from the same public
 * sub-components, so it inherits the player context and the opt-in styling.
 * Tagged `data-km-default` so the player can swap it out if the user later
 * provides their own controls.
 */
export function createDefaultControls(): HTMLElement {
  const controls = document.createElement("km-player-controls");
  controls.setAttribute("data-km-default", "");

  const progressRow = document.createElement("km-player-controls-row");
  progressRow.appendChild(document.createElement("km-player-progress"));

  const row = document.createElement("km-player-controls-row");
  row.appendChild(document.createElement("km-player-play-toggle-button"));

  const sound = document.createElement("km-player-sound-control");
  sound.setAttribute("collapsed", "");
  row.appendChild(sound);

  row.appendChild(document.createElement("km-player-time"));

  const space = document.createElement("km-player-space");
  space.setAttribute("grow", "");
  row.appendChild(space);

  row.appendChild(document.createElement("km-player-loop-button"));
  row.appendChild(document.createElement("km-player-fullscreen-button"));

  controls.appendChild(progressRow);
  controls.appendChild(row);
  return controls;
}
