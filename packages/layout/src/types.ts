import type Konva from "konva";

export type FlexDirection = "row" | "column" | "row-reverse" | "column-reverse";

export type Justify =
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type Align = "flex-start" | "center" | "flex-end" | "stretch";
export type AlignSelf = "auto" | Align;

export type EdgeValues = number | { top?: number; right?: number; bottom?: number; left?: number };

export type FlexProps = {
  flexDirection?: FlexDirection;
  justifyContent?: Justify;
  alignItems?: Align;
  gap?: number;
  padding?: EdgeValues;
};

export type FlexChildProps = {
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
  alignSelf?: AlignSelf;
  margin?: EdgeValues;
};

export type FlexGroupConfig = Konva.GroupConfig & FlexProps;
