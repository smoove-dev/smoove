import type Konva from "konva";
import type { KMEffect } from "../../effects/contract.js";

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
    width?: SizeValue;
    height?: SizeValue;
    /** Shader effects applied to this node's rendered pixels (see @smoove/effects). */
    effects?: KMEffect[];
  };
