import type { Node as FlexilyNode } from "flexily/classic";
import type Konva from "konva";

/** A computed layout rectangle, in the parent's local coordinate space. */
export type LayoutBox = { left: number; top: number; width: number; height: number };

/** Context handed to {@link KMLayoutNode._kmMeasure}. */
export type MeasureContext = { parentIsColumn: boolean };

/**
 * The open contract that lets the flex engine ({@link buildChildren} /
 * {@link writeBack} in `flex/flex.ts`) handle a node without an `instanceof`
 * switch. Any wrapper that implements it self-describes how it participates in
 * layout, so adding a new wrapped Konva element never requires editing the
 * engine.
 *
 * - **container** (Flex/Block): the engine recurses into its children and reads
 *   its flex-container attrs; it usually also exposes {@link _kmComputeLayout}.
 * - **leaf** (Image/Text/Video/shapes): the engine asks it to configure its own
 *   flexily sizing via {@link _kmMeasure}.
 *
 * After layout, every node gets {@link _kmPlace} to write the computed geometry
 * back (position, size, and any internal restyle).
 */
export interface KMLayoutNode {
  readonly _kmRole: "container" | "leaf";
  /** Leaf-only: configure this node's flexily size + intrinsic measure func. */
  _kmMeasure?(flexNode: FlexilyNode, ctx: MeasureContext): void;
  /** Write the computed box back onto the Konva node (+ internal relayout). */
  _kmPlace(box: LayoutBox): void;
  /** Container-only: lay self out as a standalone flex root (called by Sequence). */
  _kmComputeLayout?(): void;
}

export function isKMLayoutNode(n: Konva.Node): n is Konva.Node & KMLayoutNode {
  return typeof (n as Partial<KMLayoutNode>)._kmPlace === "function";
}

/** A container that can lay itself out as a flex root (Flex/Block). */
export function isKMLayoutRoot(
  n: Konva.Node,
): n is Konva.Node & Required<Pick<KMLayoutNode, "_kmComputeLayout">> {
  return typeof (n as Partial<KMLayoutNode>)._kmComputeLayout === "function";
}
