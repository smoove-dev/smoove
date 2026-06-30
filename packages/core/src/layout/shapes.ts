import Konva from "konva";
import { FlexShape } from "./flex/mixin.js";
import type { FlexChildProps, SizeValue } from "./flex/types.js";

/**
 * smoove wrappers for Konva's drawing primitives. Each one keeps Konva's
 * own name and config, and layers on flex participation (`flexGrow`,
 * `flexShrink`, `flexBasis`, `alignSelf`, `margin`) plus `px`/`%` `width`/
 * `height` size values — so any shape can sit inside a {@link Flex}/{@link Block}
 * and be laid out automatically.
 *
 * Positioning is origin-corrected (a `Circle` lands its bounding box at the
 * flex slot, not its center). Radius/points-based shapes report their intrinsic
 * size and are not stretched by `flexGrow`; give those an explicit size for
 * predictable results. Animation stays centralized in `Sequence.register`.
 */

type WithFlex<C> = Omit<C, "width" | "height"> &
  FlexChildProps & {
    width?: SizeValue;
    height?: SizeValue;
  };

export type RectConfig = WithFlex<Konva.RectConfig>;
export class Rect extends FlexShape<Konva.Rect, RectConfig>(Konva.Rect) {}

export type CircleConfig = WithFlex<Konva.CircleConfig>;
export class Circle extends FlexShape<Konva.Circle, CircleConfig>(Konva.Circle) {}

export type EllipseConfig = WithFlex<Konva.EllipseConfig>;
export class Ellipse extends FlexShape<Konva.Ellipse, EllipseConfig>(Konva.Ellipse) {}

export type LineConfig = WithFlex<Konva.LineConfig>;
export class Line extends FlexShape<Konva.Line, LineConfig>(Konva.Line) {}

export type ArrowConfig = WithFlex<Konva.ArrowConfig>;
export class Arrow extends FlexShape<Konva.Arrow, ArrowConfig>(Konva.Arrow) {}

export type StarConfig = WithFlex<Konva.StarConfig>;
export class Star extends FlexShape<Konva.Star, StarConfig>(Konva.Star) {}

export type RingConfig = WithFlex<Konva.RingConfig>;
export class Ring extends FlexShape<Konva.Ring, RingConfig>(Konva.Ring) {}

export type ArcConfig = WithFlex<Konva.ArcConfig>;
export class Arc extends FlexShape<Konva.Arc, ArcConfig>(Konva.Arc) {}

export type WedgeConfig = WithFlex<Konva.WedgeConfig>;
export class Wedge extends FlexShape<Konva.Wedge, WedgeConfig>(Konva.Wedge) {}

export type RegularPolygonConfig = WithFlex<Konva.RegularPolygonConfig>;
export class RegularPolygon extends FlexShape<Konva.RegularPolygon, RegularPolygonConfig>(
  Konva.RegularPolygon,
) {}

export type PathConfig = WithFlex<Konva.PathConfig>;
export class Path extends FlexShape<Konva.Path, PathConfig>(Konva.Path) {}

export type TextPathConfig = WithFlex<Konva.TextPathConfig>;
export class TextPath extends FlexShape<Konva.TextPath, TextPathConfig>(Konva.TextPath) {}

export type SpriteConfig = WithFlex<Konva.SpriteConfig>;
export class Sprite extends FlexShape<Konva.Sprite, SpriteConfig>(Konva.Sprite) {}
