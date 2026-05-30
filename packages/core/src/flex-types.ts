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

export type TextAlign = "left" | "center" | "right" | "justify";

/** Auto-size the font so the text fits its box (`fitText`). */
export type FitConfig = {
  /** Smallest font size to try (px). */
  min: number;
  /** Largest font size to try (px). */
  max: number;
  /** Binary-search precision in px. Default 0.5. */
  step?: number;
};

/** Built-in typewriter reveal effect. */
export type TypewriterConfig = {
  /** Reveal granularity. Default "letter". */
  mode?: "letter" | "word";
  /** Units (letters or words) revealed per frame when `durationInFrames` is unset. Default 1. */
  step?: number;
  /** Spread the full reveal evenly across this many frames (overrides `step`). */
  durationInFrames?: number;
  /**
   * Delay before the reveal begins, in local frames. Lets one Sequence drive
   * many staggered typewriters (e.g. chat messages typed one after another).
   * Default 0.
   */
  startFrame?: number;
  /** Blinking caret at the reveal head. Off by default. */
  cursor?:
    | boolean
    | {
        color?: string;
        /** Caret width in px. Default 2. */
        width?: number;
        /** Blink on/off. Default true. */
        blink?: boolean;
        /** Frames per blink half-cycle. Default 16. */
        blinkPeriodInFrames?: number;
        /** Hide the caret once the whole text is revealed. Default false. */
        hideWhenDone?: boolean;
      };
  /** Fade each freshly revealed unit in. Off by default. */
  fade?:
    | boolean
    | {
        /** Per-unit fade length in frames. Default 4. */
        durationInFrames?: number;
        easing?: (t: number) => number;
      };
  /** Reserve the full text height up front so the box never reflows as it types. Default true. */
  reserveHeight?: boolean;
};

/** A highlighter mark drawn behind a character range. */
export type HighlightConfig = {
  /** Start char index (inclusive), measured on the full text, emoji-safe. */
  start: number;
  /** End char index (exclusive). */
  end: number;
  /** Marker fill drawn behind the run. */
  background: string;
  /** Optional text color override inside the run. */
  color?: string;
  /** Extra width before the run start only — never added at a wrapped line break. */
  paddingStart?: number;
  /** Extra width after the run end only — never added at a wrapped line break. */
  paddingEnd?: number;
  /** Mark height in px, capped at the line height. Default: full line height. */
  height?: number | "line";
  /** Corner radius at the true run start only — never rounded at a wrapped line break. */
  cornerRadiusStart?: number;
  /** Corner radius at the true run end only — never rounded at a wrapped line break. */
  cornerRadiusEnd?: number;
  /** 0..1 sweep reveal of the mark (animate this per frame). Default 1 (fully shown). */
  progress?: number;
};

export type TextConfig = Omit<Konva.GroupConfig, "width" | "height" | "text"> &
  FlexChildProps & {
    /** Text content. */
    text: string;
    // ----- layout (CSS-like) -----
    width?: SizeValue;
    height?: SizeValue;
    maxWidth?: number;
    maxHeight?: number;
    fontSize?: number;
    fontFamily?: string;
    fontStyle?: string;
    fill?: string;
    align?: TextAlign;
    lineHeight?: number;
    letterSpacing?: number;
    padding?: number;
    wrap?: "word" | "char" | "none";
    ellipsis?: boolean;
    // ----- fit / clamp -----
    fitText?: FitConfig;
    maxLines?: number;
    /** How to cut overflow before the ellipsis. Default "word". */
    trimBy?: "word" | "letter";
    // ----- effects -----
    typewriter?: TypewriterConfig;
    highlights?: HighlightConfig[];
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
