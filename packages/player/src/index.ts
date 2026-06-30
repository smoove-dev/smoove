// Component styles — Vite extracts this to dist/player.css.
import "./player.css";

// Side-effect imports register every custom element on load.
import "./smoove-player.js";
import "./containers.js";
import "./play-button.js";
import "./play-toggle-button.js";
import "./sound-control.js";
import "./time.js";
import "./loop-button.js";
import "./fullscreen-button.js";
import "./progress.js";

// Layout containers
export {
  SmoovePlayerControls,
  SmoovePlayerControlsRow,
  SmoovePlayerOverlay,
  SmoovePlayerSpace,
} from "./containers.js";
// State sharing
export { getPlayerApi, playerContext } from "./context.js";
export { createDefaultControls } from "./default-controls.js";
// Event detail payloads
export type {
  FrameUpdateDetail,
  FullscreenChangeDetail,
  LoadedDetail,
  LoadStartDetail,
  MuteChangeDetail,
  PlayerErrorDetail,
  PlayPauseDetail,
  RateChangeDetail,
  ScaleChangeDetail,
  SeekedDetail,
  SmoovePlayerEventMap,
  TimeUpdateDetail,
  VolumeChangeDetail,
} from "./events.js";
export { SmoovePlayerFullscreenButton } from "./fullscreen-button.js";
export { SmoovePlayerLoopButton } from "./loop-button.js";
// Controls
export { SmoovePlayerPlayButton } from "./play-button.js";
export { SmoovePlayerPlayToggleButton } from "./play-toggle-button.js";
export type { PlayerApi, PlayerState } from "./player-api.js";
export { SmoovePlayerProgress } from "./progress.js";
// Host
export { SmoovePlayer } from "./smoove-player.js";
export { SmoovePlayerSoundControl } from "./sound-control.js";
export { SmoovePlayerTime } from "./time.js";
