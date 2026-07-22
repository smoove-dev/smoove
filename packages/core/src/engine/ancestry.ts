import type Konva from "konva";
import { CLIP_MARK, TIMELINE_MARK } from "../markers.js";
import type { Clip } from "./clip.js";
import { type Composition, getComposition } from "./composition.js";
import type { Sequence } from "./sequence.js";

/**
 * Ancestor lookups mirroring Konva's `getStage()`/`getLayer()`, exposed as
 * `getComposition()`/`getSequence()`/`getClip()` methods on every smoove node
 * (each base class forwards to these). Marker-based checks keep the runtime
 * dependencies thin; the class types are import-type only.
 *
 * All three are **self-inclusive**, like Konva's own getters: a `Sequence`'s
 * `getSequence()` and a `Clip`'s `getClip()` return the node itself.
 *
 * @module
 */

/** The method trio every smoove node exposes — see the module doc. */
export type AncestryMethods = {
  getComposition(): Composition | null;
  getSequence(): Sequence | null;
  getClip(): Clip | null;
};

/** The owning {@link Composition}, or `null` while detached. */
export function findComposition(node: Konva.Node): Composition | null {
  const stage = node.getStage();
  return stage ? getComposition(stage) : null;
}

/** The host {@link Sequence} (the nearest ancestor-or-self layer), or `null`. */
export function findSequence(node: Konva.Node): Sequence | null {
  const layer = node.getLayer();
  return layer?.getAttr(TIMELINE_MARK) === true ? (layer as unknown as Sequence) : null;
}

/** The nearest ancestor-or-self {@link Clip}, or `null`. */
export function findClip(node: Konva.Node): Clip | null {
  let p: Konva.Node | null = node;
  while (p) {
    if (p.getAttr(CLIP_MARK) === true) return p as unknown as Clip;
    p = p.getParent();
  }
  return null;
}
