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
  /** @deprecated alias of {@link trimBefore} (Remotion's pre-v4.0.319 name). */
  startFrom?: number;
  /** @deprecated alias of {@link trimAfter} (Remotion's pre-v4.0.319 name). */
  endAt?: number;
  /** Repeat the trimmed clip within its sequence window instead of freezing on the last frame. */
  loop?: boolean;
  muted?: boolean;
  /** 0..1 */
  volume?: number;
  playbackRate?: number;
  /** Inject an alternative AudioSource. Defaults to BrowserAudioSource. */
  sourceFactory?: AudioSourceFactory;
};
