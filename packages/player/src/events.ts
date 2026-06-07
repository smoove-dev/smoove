/**
 * Detail payloads for the DOM `CustomEvent`s dispatched by `<km-player>`.
 * All events bubble and are composed. Subscribe with
 * `player.addEventListener("frameupdate", (e) => e.detail.frame)`.
 */

/** `frameupdate` — fires on every frame change (playback + seeking). */
export interface FrameUpdateDetail {
  frame: number;
}

/** `timeupdate` — throttled (~4/s) periodic update during playback. */
export interface TimeUpdateDetail {
  frame: number;
  time: number;
  durationInFrames: number;
  durationInSeconds: number;
}

/** `seeked` — an explicit seek (seek bar, `seekTo`, arrow keys). */
export interface SeekedDetail {
  frame: number;
}

/** `play` / `pause` / `ended`. */
export interface PlayPauseDetail {
  frame: number;
}

/** `ratechange` — playback speed changed. */
export interface RateChangeDetail {
  playbackRate: number;
}

/** `volumechange` — volume changed. */
export interface VolumeChangeDetail {
  volume: number;
}

/** `mutechange` — mute state toggled. */
export interface MuteChangeDetail {
  muted: boolean;
}

/** `fullscreenchange` — entered/exited fullscreen. */
export interface FullscreenChangeDetail {
  isFullscreen: boolean;
}

/** `scalechange` — the letterbox scale factor changed. */
export interface ScaleChangeDetail {
  scale: number;
}

/** `error` — an exception thrown while mounting or starting playback. */
export interface PlayerErrorDetail {
  error: unknown;
}

/** Maps each event name to its `CustomEvent` detail type. */
export interface KmPlayerEventMap {
  play: CustomEvent<PlayPauseDetail>;
  pause: CustomEvent<PlayPauseDetail>;
  ended: CustomEvent<PlayPauseDetail>;
  seeked: CustomEvent<SeekedDetail>;
  frameupdate: CustomEvent<FrameUpdateDetail>;
  timeupdate: CustomEvent<TimeUpdateDetail>;
  ratechange: CustomEvent<RateChangeDetail>;
  volumechange: CustomEvent<VolumeChangeDetail>;
  mutechange: CustomEvent<MuteChangeDetail>;
  fullscreenchange: CustomEvent<FullscreenChangeDetail>;
  scalechange: CustomEvent<ScaleChangeDetail>;
  error: CustomEvent<PlayerErrorDetail>;
}
