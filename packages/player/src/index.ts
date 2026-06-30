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

// Host
export { SmoovePlayer } from "./smoove-player.js";

// Layout containers
export {
  SmoovePlayerOverlay,
  SmoovePlayerControls,
  SmoovePlayerControlsRow,
  SmoovePlayerSpace,
} from "./containers.js";

// Controls
export { SmoovePlayerPlayButton } from "./play-button.js";
export { SmoovePlayerPlayToggleButton } from "./play-toggle-button.js";
export { SmoovePlayerSoundControl } from "./sound-control.js";
export { SmoovePlayerTime } from "./time.js";
export { SmoovePlayerLoopButton } from "./loop-button.js";
export { SmoovePlayerFullscreenButton } from "./fullscreen-button.js";
export { SmoovePlayerProgress } from "./progress.js";

// State sharing
export { playerContext, getPlayerApi } from "./context.js";
export type { PlayerApi, PlayerState } from "./player-api.js";
export { createDefaultControls } from "./default-controls.js";

// Event detail payloads
export type {
  FrameUpdateDetail,
  TimeUpdateDetail,
  SeekedDetail,
  PlayPauseDetail,
  RateChangeDetail,
  VolumeChangeDetail,
  MuteChangeDetail,
  FullscreenChangeDetail,
  ScaleChangeDetail,
  PlayerErrorDetail,
  LoadStartDetail,
  LoadedDetail,
  SmoovePlayerEventMap,
} from "./events.js";
