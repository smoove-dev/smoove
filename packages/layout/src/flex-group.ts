import Konva from "konva";
import type { Edge, Yoga, Node as YogaNode } from "yoga-layout/load";
import type {
  Align,
  AlignSelf,
  EdgeValues,
  FlexChildProps,
  FlexDirection,
  FlexGroupConfig,
  FlexProps,
  Justify,
} from "./types.js";
import { getYoga } from "./yoga-loader.js";

function flexDirection(Y: Yoga, v: FlexDirection) {
  switch (v) {
    case "row":
      return Y.FLEX_DIRECTION_ROW;
    case "column":
      return Y.FLEX_DIRECTION_COLUMN;
    case "row-reverse":
      return Y.FLEX_DIRECTION_ROW_REVERSE;
    case "column-reverse":
      return Y.FLEX_DIRECTION_COLUMN_REVERSE;
  }
}

function justify(Y: Yoga, v: Justify) {
  switch (v) {
    case "flex-start":
      return Y.JUSTIFY_FLEX_START;
    case "center":
      return Y.JUSTIFY_CENTER;
    case "flex-end":
      return Y.JUSTIFY_FLEX_END;
    case "space-between":
      return Y.JUSTIFY_SPACE_BETWEEN;
    case "space-around":
      return Y.JUSTIFY_SPACE_AROUND;
    case "space-evenly":
      return Y.JUSTIFY_SPACE_EVENLY;
  }
}

function align(Y: Yoga, v: Align) {
  switch (v) {
    case "flex-start":
      return Y.ALIGN_FLEX_START;
    case "center":
      return Y.ALIGN_CENTER;
    case "flex-end":
      return Y.ALIGN_FLEX_END;
    case "stretch":
      return Y.ALIGN_STRETCH;
  }
}

function alignSelf(Y: Yoga, v: AlignSelf) {
  return v === "auto" ? Y.ALIGN_AUTO : align(Y, v);
}

function applyEdges(
  Y: Yoga,
  node: YogaNode,
  value: EdgeValues | undefined,
  setter: "setPadding" | "setMargin",
): void {
  if (value === undefined) return;
  if (typeof value === "number") {
    node[setter](Y.EDGE_ALL as Edge, value);
    return;
  }
  if (value.top !== undefined) node[setter](Y.EDGE_TOP as Edge, value.top);
  if (value.right !== undefined) node[setter](Y.EDGE_RIGHT as Edge, value.right);
  if (value.bottom !== undefined) node[setter](Y.EDGE_BOTTOM as Edge, value.bottom);
  if (value.left !== undefined) node[setter](Y.EDGE_LEFT as Edge, value.left);
}

function applyContainerProps(Y: Yoga, node: YogaNode, props: FlexProps): void {
  node.setFlexDirection(flexDirection(Y, props.flexDirection ?? "row"));
  if (props.justifyContent) node.setJustifyContent(justify(Y, props.justifyContent));
  if (props.alignItems) node.setAlignItems(align(Y, props.alignItems));
  if (props.gap !== undefined) node.setGap(Y.GUTTER_ALL, props.gap);
  applyEdges(Y, node, props.padding, "setPadding");
}

function applyChildProps(
  Y: Yoga,
  yChild: YogaNode,
  attrs: FlexChildProps & { width?: number; height?: number },
): void {
  if (attrs.flexGrow !== undefined) yChild.setFlexGrow(attrs.flexGrow);
  if (attrs.flexShrink !== undefined) yChild.setFlexShrink(attrs.flexShrink);
  if (attrs.flexBasis !== undefined) yChild.setFlexBasis(attrs.flexBasis);
  if (attrs.alignSelf !== undefined) yChild.setAlignSelf(alignSelf(Y, attrs.alignSelf));
  applyEdges(Y, yChild, attrs.margin, "setMargin");
  if (attrs.flexBasis === undefined) {
    if (attrs.width !== undefined && attrs.width > 0) yChild.setWidth(attrs.width);
    if (attrs.height !== undefined && attrs.height > 0) yChild.setHeight(attrs.height);
  }
}

export class FlexGroup extends Konva.Group {
  // biome-ignore lint/complexity/noUselessConstructor: narrows the config type to FlexGroupConfig.
  constructor(config: FlexGroupConfig) {
    super(config);
  }

  computeLayout(): void {
    const Y = getYoga();
    const root = Y.Node.create();

    applyContainerProps(Y, root, this.getAttrs() as FlexProps);
    const w = this.width();
    const h = this.height();
    if (w > 0) root.setWidth(w);
    if (h > 0) root.setHeight(h);

    const children = this.getChildren();
    const yChildren: YogaNode[] = [];
    children.forEach((child, i) => {
      const yChild = Y.Node.create();
      applyChildProps(
        Y,
        yChild,
        child.getAttrs() as FlexChildProps & { width?: number; height?: number },
      );
      root.insertChild(yChild, i);
      yChildren.push(yChild);
    });

    root.calculateLayout(undefined, undefined, Y.DIRECTION_LTR);

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const yChild = yChildren[i];
      if (!child || !yChild) continue;
      const layout = yChild.getComputedLayout();
      child.position({ x: layout.left, y: layout.top });
      child.size({ width: layout.width, height: layout.height });
    }

    root.freeRecursive();
  }
}
