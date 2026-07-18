/**
 * The engine's general **node-marker contract**: string attrs stamped on Konva
 * nodes so the engine and tooling can discover and classify nodes by string,
 * without importing the node classes (which would create import cycles). A
 * sibling of `layout/contract.ts` (the `KMLayoutNode` contract). Kept
 * dependency-free (type-only Konva import) so `composition.ts`/`sequence.ts`
 * can consume it from any layer.
 */

import type Konva from "konva";

/** Set by every tickable media node — drives Sequence discovery + mixer registration. */
export const MEDIA_MARK = "__kmIsMedia";
/** Additionally set by `Video` — backs {@link isVideoNode}. */
export const VIDEO_MARK = "__kmIsVideo";
/** Additionally set by `Audio` — backs {@link isAudioNode}. */
export const AUDIO_MARK = "__kmIsAudio";
/**
 * Set by non-media nodes that still want a per-frame `_kmTick` callback (e.g.
 * `Text`'s typewriter). Discovered by `Sequence` alongside media, but NOT
 * registered with the audio mixer.
 */
export const TICK_MARK = "__kmIsTick";
/**
 * Set by `Font` nodes. Walked by `Composition.add` so a scene-declared font is
 * loaded (and buffered on) before playback — discovered by string so
 * `composition.ts` need not import `layout/text/`.
 */
export const FONT_MARK = "__kmIsFont";
/**
 * Set by smoove's `Group` container — distinguishes an author-created grouping
 * node from the internal `Konva.Group`s smoove builds inside `Text`, `Flex`,
 * etc. Backs `isGroupNode`.
 */
export const GROUP_MARK = "__kmIsGroup";

/**
 * True if `node` is an audio media node. A pure mark check with no dependency
 * on the `Audio` class, so it lives in core even though `Audio` ships in
 * `@smoove/media`. `@smoove/renderer` uses it as a boolean media probe;
 * `@smoove/media` re-exports a typed guard that narrows to its concrete `Audio`.
 */
export function isAudioNode(node: Konva.Node): boolean {
  return node.getAttr(AUDIO_MARK) === true;
}

/** True if `node` is a video media node. See {@link isAudioNode}. */
export function isVideoNode(node: Konva.Node): boolean {
  return node.getAttr(VIDEO_MARK) === true;
}
