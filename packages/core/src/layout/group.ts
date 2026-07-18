import Konva from "konva";
import { GROUP_MARK } from "../media/media-marker.js";

export type GroupConfig = Konva.GroupConfig;

/**
 * smoove's plain container — a thin {@link Konva.Group} subclass that stamps a
 * {@link GROUP_MARK} attr (the same marker pattern the media nodes use) so the
 * engine and tooling can tell an author-created group apart from the internal
 * groups smoove builds inside `Text`, `Flex`, etc. For automatic layout reach
 * for `Flex`/`Block`; `Group` is the manual transform/grouping container.
 */
export class Group extends Konva.Group {
  constructor(config?: GroupConfig) {
    super(config);
    this.setAttr(GROUP_MARK, true);
  }
}

/** True for a smoove {@link Group} — marker-based, so it survives across realms. */
export function isGroupNode(node: Konva.Node): node is Group {
  return node.getAttr(GROUP_MARK) === true;
}
