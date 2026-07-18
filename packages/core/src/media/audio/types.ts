import type { AudioSourceFactory } from "./audio-source.js";

/**
 * Config for {@link Audio}. Mirrors Remotion's `<Audio>` playback props
 * (`trimBefore`/`trimAfter`/`loop`/`muted`/`volume`/`playbackRate`) plus a
 * `sourceFactory` dependency-injection seam. Unlike {@link VideoConfig} there
 * are no visual/layout props — audio produces no pixels.
 */
export type AudioConfig = {
  src: string;
  /** Stable id used for the Konva node and rendered {@link AudioAsset}s. */
  id?: string;
  /** Human label for the audio mixer channel / UIs. Defaults to {@link src}. */
  name?: string;
  /** Frames trimmed from the start of the media (composition fps). Remotion v4 name. */
  trimBefore?: number;
  /** Exclusive frame bound — media past this offset is trimmed (composition fps). */
  trimAfter?: number;
  /**
   * Play-window trim: a friendlier form of {@link trimBefore}/{@link trimAfter}
   * expressed as "start here, play this many frames" instead of two absolute
   * bounds you subtract by hand. `{ start, play }` maps to
   * `trimBefore = start`, `trimAfter = start + play`. Wins over
   * `trimBefore`/`trimAfter`/`startFrom`/`endAt` for the fields it sets; a
   * `trim` without `play` leaves the end bound to `trimAfter`/`endAt` (natural
   * end). All in composition fps.
   */
  trim?: { start?: number; play?: number };
  /** @deprecated alias of {@link trimBefore} (Remotion's pre-v4.0.319 name). */
  startFrom?: number;
  /** @deprecated alias of {@link trimAfter} (Remotion's pre-v4.0.319 name). */
  endAt?: number;
  /** Repeat the trimmed clip within its sequence window instead of freezing on the last frame. */
  loop?: boolean;
  muted?: boolean;
  /**
   * Playback level. `1` is unity; `0` is silent. Values above `1` amplify —
   * honored by the default preview path (Web Audio `GainNode`) and the render
   * mux. The legacy `HTMLAudioElement` source physically caps at `1`.
   */
  volume?: number;
  playbackRate?: number;
  /** Inject an alternative AudioSource. Defaults to BrowserAudioSource. */
  sourceFactory?: AudioSourceFactory;
};
