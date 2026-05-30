import {
  ALIGN_AUTO,
  ALIGN_CENTER,
  ALIGN_FLEX_END,
  ALIGN_FLEX_START,
  ALIGN_STRETCH,
  EDGE_BOTTOM,
  EDGE_LEFT,
  EDGE_RIGHT,
  EDGE_TOP,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_COLUMN_REVERSE,
  FLEX_DIRECTION_ROW,
  FLEX_DIRECTION_ROW_REVERSE,
  Node as FlexilyNode,
  GUTTER_ALL,
  JUSTIFY_CENTER,
  JUSTIFY_FLEX_END,
  JUSTIFY_FLEX_START,
  JUSTIFY_SPACE_AROUND,
  JUSTIFY_SPACE_BETWEEN,
  JUSTIFY_SPACE_EVENLY,
} from "flexily/classic";
import type Konva from "konva";
import type {
  Align,
  AlignSelf,
  EdgeValue,
  FlexChildProps,
  FlexDirection,
  FlexProps,
  Justify,
  SizeValue,
} from "./flex-types.js";

export type Edges = [number, number, number, number];

export function normalizeEdges(v: EdgeValue | undefined): Edges | null {
  if (v === undefined) return null;
  if (typeof v === "number") return [v, v, v, v];
  if (Array.isArray(v)) {
    if (v.length === 2) return [v[0], v[1], v[0], v[1]];
    if (v.length === 4) return [v[0], v[1], v[2], v[3]];
  } else {
    return [v.top ?? 0, v.right ?? 0, v.bottom ?? 0, v.left ?? 0];
  }
  return null;
}

export function parseSize(
  v: SizeValue | undefined,
): { kind: "px"; value: number } | { kind: "pct"; value: number } | null {
  if (v === undefined) return null;
  if (typeof v === "number") return { kind: "px", value: v };
  const m = /^(-?\d+(?:\.\d+)?)%$/.exec(v);
  if (m) return { kind: "pct", value: Number.parseFloat(m[1] ?? "0") };
  return null;
}

function flexDirection(v: FlexDirection): number {
  switch (v) {
    case "row":
      return FLEX_DIRECTION_ROW;
    case "column":
      return FLEX_DIRECTION_COLUMN;
    case "row-reverse":
      return FLEX_DIRECTION_ROW_REVERSE;
    case "column-reverse":
      return FLEX_DIRECTION_COLUMN_REVERSE;
  }
}

function justifyContent(v: Justify): number {
  switch (v) {
    case "flex-start":
      return JUSTIFY_FLEX_START;
    case "center":
      return JUSTIFY_CENTER;
    case "flex-end":
      return JUSTIFY_FLEX_END;
    case "space-between":
      return JUSTIFY_SPACE_BETWEEN;
    case "space-around":
      return JUSTIFY_SPACE_AROUND;
    case "space-evenly":
      return JUSTIFY_SPACE_EVENLY;
  }
}

function alignItems(v: Align): number {
  switch (v) {
    case "flex-start":
      return ALIGN_FLEX_START;
    case "center":
      return ALIGN_CENTER;
    case "flex-end":
      return ALIGN_FLEX_END;
    case "stretch":
      return ALIGN_STRETCH;
  }
}

function alignSelfValue(v: AlignSelf): number {
  return v === "auto" ? ALIGN_AUTO : alignItems(v);
}

const EDGE_BY_INDEX = [EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM, EDGE_LEFT];

export function applyEdges(
  node: FlexilyNode,
  edges: Edges | null,
  setter: "setPadding" | "setMargin" | "setBorder",
): void {
  if (!edges) return;
  for (let i = 0; i < 4; i++) {
    const e = EDGE_BY_INDEX[i];
    const val = edges[i];
    if (e !== undefined && val !== undefined) node[setter](e, val);
  }
}

export function applySize(
  node: FlexilyNode,
  w: SizeValue | undefined,
  h: SizeValue | undefined,
): void {
  const pw = parseSize(w);
  const ph = parseSize(h);
  if (pw) {
    if (pw.kind === "px") node.setWidth(pw.value);
    else node.setWidthPercent(pw.value);
  }
  if (ph) {
    if (ph.kind === "px") node.setHeight(ph.value);
    else node.setHeightPercent(ph.value);
  }
}

export function applyContainerProps(node: FlexilyNode, props: FlexProps): void {
  node.setFlexDirection(flexDirection(props.flexDirection ?? "row"));
  if (props.justifyContent) node.setJustifyContent(justifyContent(props.justifyContent));
  if (props.alignItems) node.setAlignItems(alignItems(props.alignItems));
  if (props.gap !== undefined) node.setGap(GUTTER_ALL, props.gap);
  applyEdges(node, normalizeEdges(props.padding), "setPadding");
}

export function applyChildProps(node: FlexilyNode, props: FlexChildProps): void {
  if (props.flexGrow !== undefined) node.setFlexGrow(props.flexGrow);
  if (props.flexShrink !== undefined) node.setFlexShrink(props.flexShrink);
  if (props.flexBasis !== undefined) node.setFlexBasis(props.flexBasis);
  if (props.alignSelf !== undefined) node.setAlignSelf(alignSelfValue(props.alignSelf));
  applyEdges(node, normalizeEdges(props.margin), "setMargin");
}

type KonvaTextInternal = Konva.Text & {
  _setTextData: () => void;
  textArr: { text: string; width: number }[];
};

export function setTextMeasure(node: FlexilyNode, text: Konva.Text, parentIsColumn: boolean): void {
  if (text.attrs.wrap === undefined) text.wrap("word");
  node.setMeasureFunc((arg0, _wMode, arg2) => {
    // flexily quirk: from the flex-basis path, args are (mainAxis, mainMode, crossAxis, crossMode).
    // For a column parent, the cross-axis (width we want to wrap to) is the THIRD arg.
    const widthCandidates = parentIsColumn ? [arg2, arg0] : [arg0, arg2];
    let avail = 0;
    for (const c of widthCandidates) {
      if (Number.isFinite(c) && c > 0) {
        avail = c;
        break;
      }
    }
    const w = avail > 0 ? avail : 1e9;
    const prevWidth = text.attrs.width;
    text.width(w);
    const ti = text as KonvaTextInternal;
    ti._setTextData();
    const lines = ti.textArr.length || 1;
    const fontSize = text.fontSize();
    const lineHeight = text.lineHeight();
    const padding = text.padding() ?? 0;
    const longest = ti.textArr.reduce((m, l) => Math.max(m, l.width), 0);
    const measuredW = longest + padding * 2;
    const measuredH = lines * fontSize * lineHeight + padding * 2;
    text.setAttr("width", prevWidth);
    return { width: Math.min(measuredW, w), height: measuredH };
  });
}

/**
 * Structural view of the `Text` wrapper — typed here (rather than imported)
 * so this leaf module stays free of a cycle through `text.ts`.
 */
type TextWrapper = {
  _measureForFlex: (avail: number) => { width: number; height: number };
};

export function setTextWrapperMeasure(
  node: FlexilyNode,
  wrapper: TextWrapper,
  parentIsColumn: boolean,
): void {
  node.setMeasureFunc((arg0, _wMode, arg2) => {
    // Same flexily arg quirk as setTextMeasure: for a column parent the wrap
    // width is the cross-axis (third) arg.
    const widthCandidates = parentIsColumn ? [arg2, arg0] : [arg0, arg2];
    let avail = 0;
    for (const c of widthCandidates) {
      if (Number.isFinite(c) && c > 0) {
        avail = c;
        break;
      }
    }
    const { width, height } = wrapper._measureForFlex(avail > 0 ? avail : 1e9);
    return { width: avail > 0 ? Math.min(width, avail) : width, height };
  });
}

export function setImageMeasure(node: FlexilyNode, image: Konva.Image): void {
  const src = image.image() as HTMLImageElement | HTMLCanvasElement | undefined;
  let w = 0;
  let h = 0;
  if (src && "naturalWidth" in src) {
    w = src.naturalWidth;
    h = src.naturalHeight;
  } else if (src) {
    w = src.width;
    h = src.height;
  }
  if (w > 0 && h > 0) {
    node.setMeasureFunc(() => ({ width: w, height: h }));
  }
}

export { FlexilyNode };
