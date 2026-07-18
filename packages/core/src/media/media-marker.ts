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
/**
 * Set by non-media nodes that still want a per-frame `_kmTick` callback (e.g.
 * {@link Text}'s typewriter). Discovered by `Sequence` alongside media, but
 * NOT registered with the audio mixer.
 */
export const TICK_MARK = "__kmIsTick";
/**
 * Set by {@link Font} nodes. Walked by `Composition.add` so a scene-declared
 * font is loaded (and buffered on) before playback. Kept here, like the other
 * markers, so `composition.ts` discovers fonts by string without importing
 * `layout/text/` (avoiding an import cycle).
 */
export const FONT_MARK = "__kmIsFont";
/**
 * Set by smoove's {@link Group} container — distinguishes an author-created
 * grouping node from the internal `Konva.Group`s smoove builds inside `Text`,
 * `Flex`, etc. Not consumed by the engine today; stamped so tooling (studio
 * tree, serialization, layout passes) can identify author groups later. Backs
 * `isGroupNode`.
 */
export const GROUP_MARK = "__kmIsGroup";
