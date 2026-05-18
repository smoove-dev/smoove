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

export type EdgeColor =
  | string
  | [string, string]
  | [string, string, string, string]
  | { top?: string; right?: string; bottom?: string; left?: string };

export type SizeValue = number | `${number}%`;

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

export type GradientStop = [number, string];
export type GradientBackground = {
  gradient: {
    type: "linear" | "radial";
    stops: GradientStop[];
    angle?: number;
  };
};
export type BackgroundValue = string | GradientBackground;

export type ShadowProps = {
  color?: string;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
};

export type FlexConfig = Omit<Konva.GroupConfig, "width" | "height"> &
  FlexProps &
  FlexChildProps & {
    width?: SizeValue;
    height?: SizeValue;
  };

export type BlockConfig = Omit<Konva.GroupConfig, "width" | "height"> &
  FlexProps &
  FlexChildProps & {
    width?: SizeValue;
    height?: SizeValue;
    borderSize?: EdgeValue;
    borderColor?: EdgeColor;
    borderStyle?: "solid" | "dashed";
    shadow?: ShadowProps;
    background?: BackgroundValue;
    cornerRadius?: number | number[];
  };

export type ObjectFit = "cover" | "contain" | "fill" | "none";
export type ObjectPosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top left"
  | "top right"
  | "bottom left"
  | "bottom right";

export type ImageConfig = Omit<Konva.GroupConfig, "width" | "height"> &
  FlexChildProps & {
    width?: SizeValue;
    height?: SizeValue;
    src: HTMLImageElement | string;
    objectFit?: ObjectFit;
    objectPosition?: ObjectPosition;
    cornerRadius?: number | number[];
  };
