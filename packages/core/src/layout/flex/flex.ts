import { DIRECTION_LTR } from "flexily/classic";
import Konva from "konva";
import { isKMLayoutNode, type KMLayoutNode, type LayoutBox } from "../contract.js";
import {
  applyChildProps,
  applyContainerProps,
  applySize,
  FlexilyNode,
  parseSize,
  setImageMeasure,
  setTextMeasure,
} from "./engine.js";
import type { FlexChildProps, FlexConfig, FlexProps, SizeValue } from "./types.js";

const FLEX_KEYS = [
  "flexDirection",
  "justifyContent",
  "alignItems",
  "gap",
  "padding",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "margin",
] as const;

function pickKonvaConfig(config: FlexConfig): Konva.GroupConfig {
  const out: Record<string, unknown> = { ...config };
  for (const k of FLEX_KEYS) delete out[k];
  const w = parseSize(config.width as SizeValue | undefined);
  const h = parseSize(config.height as SizeValue | undefined);
  out.width = w?.kind === "px" ? w.value : undefined;
  out.height = h?.kind === "px" ? h.value : undefined;
  return out as Konva.GroupConfig;
}

export class Flex extends Konva.Group implements KMLayoutNode {
  readonly _kmRole = "container" as const;

  constructor(config: FlexConfig) {
    super(pickKonvaConfig(config));
    this.setAttrs({
      flexDirection: config.flexDirection,
      justifyContent: config.justifyContent,
      alignItems: config.alignItems,
      gap: config.gap,
      padding: config.padding,
      flexGrow: config.flexGrow,
      flexShrink: config.flexShrink,
      flexBasis: config.flexBasis,
      alignSelf: config.alignSelf,
      margin: config.margin,
      flexWidth: config.width,
      flexHeight: config.height,
    });
  }

  computeLayout(): void {
    layoutRoot(this, false);
  }

  /** @internal — {@link KMLayoutNode}: lay self out as a flex root (Sequence calls this). */
  _kmComputeLayout(): void {
    this.computeLayout();
  }

  /** @internal — {@link KMLayoutNode}: write the computed box back (nested in a parent flex). */
  _kmPlace(box: LayoutBox): void {
    this.x(box.left);
    this.y(box.top);
    this.width(box.width);
    this.height(box.height);
  }
}

/**
 * Lay out a Konva.Group as a Flexily root: build the layout tree from the
 * group's attrs + children, compute, and write positions/sizes back.
 *
 * When `alwaysSetSize` is true the group's own width/height are always pulled
 * from the computed content size — needed for a hug-content root that draws a
 * background (Block) so the background isn't 0×0. Flex passes false, preserving
 * its behavior of only writing self-size when an explicit px size is given.
 */
export function layoutRoot(group: Konva.Group, alwaysSetSize: boolean): void {
  const w = readPixelSize(group.attrs.flexWidth);
  const h = readPixelSize(group.attrs.flexHeight);

  const root = FlexilyNode.create();
  applyContainerProps(root, group.attrs as FlexProps);
  if (w > 0) root.setWidth(w);
  if (h > 0) root.setHeight(h);

  const pairs: Pair[] = [];
  buildChildren(group.getChildren(), root, pairs, group.attrs.flexDirection ?? "row");

  root.calculateLayout(w > 0 ? w : undefined, h > 0 ? h : undefined, DIRECTION_LTR);

  if (alwaysSetSize || w > 0) group.width(root.getComputedWidth());
  if (alwaysSetSize || h > 0) group.height(root.getComputedHeight());
  writeBack(pairs);
  root.freeRecursive();
}

type Pair = {
  konva: Konva.Node;
  flex: ReturnType<typeof FlexilyNode.create>;
};

function readPixelSize(sizeAttr: SizeValue | undefined): number {
  const parsed = parseSize(sizeAttr);
  if (parsed?.kind === "px") return parsed.value;
  // No explicit px size → hug content. Return 0 (not the node's current Konva
  // size): falling back to the last-computed size would pin a hug-content root
  // to its first-tick height and stop it re-growing as children change size.
  return 0;
}

export function buildChildren(
  children: readonly Konva.Node[],
  parentFlex: ReturnType<typeof FlexilyNode.create>,
  pairs: Pair[],
  parentDirection = "row",
): void {
  // Skip the Block background rect and any hidden child (display:none semantics —
  // an invisible node takes no layout space, so staggered/toggled children don't
  // leave gaps).
  const laidOut = children.filter((c) => !c.attrs.__blockBg && c.visible() !== false);
  const parentIsColumn = parentDirection.startsWith("column");
  laidOut.forEach((child, i) => {
    const node = FlexilyNode.create();
    applyChildProps(node, child.attrs as FlexChildProps);

    if (isKMLayoutNode(child)) {
      // smoove wrapper: it self-describes its layout via the contract.
      if (child._kmRole === "container") {
        const props = child.attrs as FlexProps;
        applyContainerProps(node, props);
        applySize(node, child.attrs.flexWidth, child.attrs.flexHeight);
        buildChildren(
          (child as unknown as Konva.Container).getChildren(),
          node,
          pairs,
          props.flexDirection ?? "row",
        );
      } else {
        child._kmMeasure?.(node, { parentIsColumn });
      }
    } else if (child instanceof Konva.Text) {
      // Raw Konva.Text (no wrapper): measure with wrap awareness.
      if (child.attrs.flexWidth === undefined && parentIsColumn) node.setWidthPercent(100);
      else applySize(node, child.attrs.flexWidth, undefined);
      setTextMeasure(node, child, parentIsColumn);
    } else if (child instanceof Konva.Image) {
      // Raw Konva.Image (no wrapper): intrinsic size from the bitmap.
      applySize(node, child.attrs.flexWidth, child.attrs.flexHeight);
      if (child.attrs.flexWidth === undefined && child.attrs.flexHeight === undefined) {
        setImageMeasure(node, child);
      }
    } else {
      // Any other raw Konva node: size from numeric width/height attrs.
      const w = child.attrs.width;
      const h = child.attrs.height;
      if (typeof w === "number" && w > 0) node.setWidth(w);
      if (typeof h === "number" && h > 0) node.setHeight(h);
    }

    pairs.push({ konva: child, flex: node });
    parentFlex.insertChild(node, i);
  });
}

export function writeBack(pairs: Pair[]): void {
  for (const { konva, flex } of pairs) {
    const left = flex.getComputedLeft();
    const top = flex.getComputedTop();
    const width = flex.getComputedWidth();
    const height = flex.getComputedHeight();

    if (isKMLayoutNode(konva)) {
      // Wrapper handles its own position/size/restyle (origin-corrected per shape).
      konva._kmPlace({ left, top, width, height });
      continue;
    }

    // Raw Konva fallback. Origin-correct via getSelfRect so centered-origin
    // shapes (e.g. a bare Konva.Circle) land their bounding box at the slot;
    // top-left-origin nodes have selfRect.x === 0, so this is a no-op for them.
    const r = (konva as Konva.Shape).getSelfRect();
    konva.x(left - r.x);
    konva.y(top - r.y);
    if (konva instanceof Konva.Text) {
      if (konva.attrs.wrap === undefined) konva.wrap("word");
      konva.width(width);
    } else {
      konva.width(width);
      konva.height(height);
    }
  }
}
