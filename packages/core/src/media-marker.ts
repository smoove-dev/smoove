/**
 * Marker attrs stamped on media nodes ({@link Video}, {@link Audio}) and
 * inspected by `Sequence`/`Composition`. Kept in a dependency-free leaf so
 * `composition.ts` can discover media by string without importing `video/` or
 * `audio/` (which would create an import cycle).
 */

/** Set by every tickable media node — drives Sequence discovery + mixer registration. */
export const MEDIA_MARK = "__kmIsMedia";
/** Additionally set by {@link Video} — backs `isVideoNode`. */
export const VIDEO_MARK = "__kmIsVideo";
/** Additionally set by {@link Audio} — backs `isAudioNode`. */
export const AUDIO_MARK = "__kmIsAudio";
