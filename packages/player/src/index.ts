// Component styles — Vite extracts this to dist/player.css.
import "./player.css";

// Side-effect imports register every custom element on load.
import "./km-player.js";
import "./containers.js";
import "./play-button.js";
import "./play-toggle-button.js";
import "./sound-control.js";
import "./time.js";
import "./loop-button.js";
import "./fullscreen-button.js";
import "./progress.js";

// Host
export { KmPlayer } from "./km-player.js";

// Layout containers
export {
  KmPlayerOverlay,
  KmPlayerControls,
  KmPlayerControlsRow,
  KmPlayerSpace,
} from "./containers.js";

// Controls
export { KmPlayerPlayButton } from "./play-button.js";
export { KmPlayerPlayToggleButton } from "./play-toggle-button.js";
export { KmPlayerSoundControl } from "./sound-control.js";
export { KmPlayerTime } from "./time.js";
export { KmPlayerLoopButton } from "./loop-button.js";
export { KmPlayerFullscreenButton } from "./fullscreen-button.js";
export { KmPlayerProgress } from "./progress.js";

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
  KmPlayerEventMap,
} from "./events.js";
