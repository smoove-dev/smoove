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
 * Build the default control bar used when `<smoove-player controls>` has no
 * user-supplied `<smoove-player-controls>`. It is composed from the same public
 * sub-components, so it inherits the player context and the opt-in styling.
 * Tagged `data-smoove-default` so the player can swap it out if the user later
 * provides their own controls.
 */
export function createDefaultControls(): HTMLElement {
  const controls = document.createElement("smoove-player-controls");
  controls.setAttribute("data-smoove-default", "");

  const progressRow = document.createElement("smoove-player-controls-row");
  progressRow.appendChild(document.createElement("smoove-player-progress"));

  const row = document.createElement("smoove-player-controls-row");
  row.appendChild(document.createElement("smoove-player-play-toggle-button"));

  const sound = document.createElement("smoove-player-sound-control");
  sound.setAttribute("collapsed", "");
  row.appendChild(sound);

  row.appendChild(document.createElement("smoove-player-time"));

  const space = document.createElement("smoove-player-space");
  space.setAttribute("grow", "");
  row.appendChild(space);

  row.appendChild(document.createElement("smoove-player-loop-button"));
  row.appendChild(document.createElement("smoove-player-fullscreen-button"));

  controls.appendChild(progressRow);
  controls.appendChild(row);
  return controls;
}
