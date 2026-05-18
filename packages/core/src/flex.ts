import { DIRECTION_LTR } from "flexily/classic";
import Konva from "konva";
import { Block } from "./block.js";
import {
  FlexilyNode,
  applyChildProps,
  applyContainerProps,
  applySize,
  parseSize,
  setImageMeasure,
  setTextMeasure,
} from "./flex-engine.js";
import type { FlexChildProps, FlexConfig, FlexProps, SizeValue } from "./flex-types.js";
import { Image as KMImage } from "./image.js";

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

export class Flex extends Konva.Group {
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
    const w = readPixelSize(this.attrs.flexWidth, this.width());
    const h = readPixelSize(this.attrs.flexHeight, this.height());

    const root = FlexilyNode.create();
    applyContainerProps(root, this.attrs as FlexProps);
    if (w > 0) root.setWidth(w);
    if (h > 0) root.setHeight(h);

    const pairs: Pair[] = [];
    buildChildren(this.getChildren(), root, pairs, this.attrs.flexDirection ?? "row");

    root.calculateLayout(w > 0 ? w : undefined, h > 0 ? h : undefined, DIRECTION_LTR);

    if (w > 0) this.width(root.getComputedWidth());
    if (h > 0) this.height(root.getComputedHeight());
    writeBack(pairs);
    root.freeRecursive();
  }
}

type Pair = {
  konva: Konva.Node;
  flex: ReturnType<typeof FlexilyNode.create>;
  isContainer: boolean;
};

function readPixelSize(sizeAttr: SizeValue | undefined, konvaSize: number): number {
  const parsed = parseSize(sizeAttr);
  if (parsed?.kind === "px") return parsed.value;
  return konvaSize;
}

export function buildChildren(
  children: readonly Konva.Node[],
  parentFlex: ReturnType<typeof FlexilyNode.create>,
  pairs: Pair[],
  parentDirection = "row",
): void {
  const laidOut = children.filter((c) => !c.attrs.__blockBg);
  const parentIsColumn = parentDirection.startsWith("column");
  laidOut.forEach((child, i) => {
    const node = FlexilyNode.create();
    applyChildProps(node, child.attrs as FlexChildProps);

    if (child instanceof Flex || child instanceof Block) {
      const props = child.attrs as FlexProps;
      applyContainerProps(node, props);
      applySize(node, child.attrs.flexWidth, child.attrs.flexHeight);
      buildChildren(child.getChildren(), node, pairs, props.flexDirection ?? "row");
      pairs.push({ konva: child, flex: node, isContainer: true });
    } else if (child instanceof KMImage) {
      applySize(node, child.attrs.flexWidth, child.attrs.flexHeight);
      pairs.push({ konva: child, flex: node, isContainer: true });
    } else if (child instanceof Konva.Text) {
      if (child.attrs.flexWidth === undefined && parentIsColumn) node.setWidthPercent(100);
      else applySize(node, child.attrs.flexWidth, undefined);
      setTextMeasure(node, child, parentIsColumn);
      pairs.push({ konva: child, flex: node, isContainer: false });
    } else if (child instanceof Konva.Image) {
      applySize(node, child.attrs.flexWidth, child.attrs.flexHeight);
      if (child.attrs.flexWidth === undefined && child.attrs.flexHeight === undefined) {
        setImageMeasure(node, child);
      }
      pairs.push({ konva: child, flex: node, isContainer: false });
    } else {
      const w = child.attrs.width;
      const h = child.attrs.height;
      if (typeof w === "number" && w > 0) node.setWidth(w);
      if (typeof h === "number" && h > 0) node.setHeight(h);
      pairs.push({ konva: child, flex: node, isContainer: false });
    }

    parentFlex.insertChild(node, i);
  });
}

export function writeBack(pairs: Pair[]): void {
  for (const { konva, flex, isContainer } of pairs) {
    konva.x(flex.getComputedLeft());
    konva.y(flex.getComputedTop());
    const w = flex.getComputedWidth();
    const h = flex.getComputedHeight();
    if (isContainer) {
      konva.width(w);
      konva.height(h);
      if (konva instanceof Block) konva._layoutBackground();
      else if (konva instanceof KMImage) konva._layoutImage();
    } else if (konva instanceof Konva.Text) {
      if (konva.attrs.wrap === undefined) konva.wrap("word");
      konva.width(w);
    } else if (!(konva instanceof Konva.Image)) {
      konva.width(w);
      konva.height(h);
    } else {
      konva.width(w);
      konva.height(h);
    }
  }
}
