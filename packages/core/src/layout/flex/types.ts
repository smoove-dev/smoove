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

export type EdgeValue =
  | number
  | [number, number]
  | [number, number, number, number]
  | { top?: number; right?: number; bottom?: number; left?: number };

export type SizeValue = number | `${number}%`;

/** What a `width`/`height` config or setter accepts. `"auto"` hands the size back to layout. */
export type SizeInput = SizeValue | "auto" | undefined;

export type FlexProps = {
  flexDirection?: FlexDirection;
  justifyContent?: Justify;
  alignItems?: Align;
  gap?: number;
  padding?: EdgeValue;
};

export type FlexChildProps = {
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
  alignSelf?: AlignSelf;
  margin?: EdgeValue;
};

export type FlexConfig = Omit<Konva.GroupConfig, "width" | "height"> &
  FlexProps &
  FlexChildProps & {
    width?: SizeInput;
    height?: SizeInput;
  };
