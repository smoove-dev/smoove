import type Konva from "konva";
import type { FlexChildProps, SizeValue } from "../flex/types.js";
import type { Font, FontFaceRef } from "./font.js";

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
    /**
     * A declarative {@link Font} (or a specific `font.face(selector)`). Overrides
     * `fontFamily`/`fontStyle` (weight + style are derived from the face) and
     * re-lays-out automatically once the font finishes loading. A bare `Font`
     * uses its preferred face (`400`/`normal`, else the first declared face).
     */
    font?: Font | FontFaceRef;
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
