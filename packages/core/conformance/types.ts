import type Konva from "konva";
import type { Block, Sequence } from "../src/index.js";

/** A stage-space axis-aligned rectangle. */
export type Rect = { x: number; y: number; width: number; height: number };

/** What a case's `expect` function gets to interrogate. */
export type CaseProbe = {
  /** Stage-space box of the first node matching a Konva selector (`.name`, `#id`, `Type`). */
  box(selector: string): Rect;
  /** Stage-space boxes of every match, in tree order. */
  boxes(selector: string): Rect[];
  /** The first matching node, for anything the probe does not cover. */
  node(selector: string): Konva.Node;
  /** The rendered pixel at a stage coordinate, as `#rrggbb` or `"transparent"`. */
  at(x: number, y: number): string;
  /** Assert a rendered pixel, with a tolerance for antialiasing (default 6/255 per channel). */
  expectColor(x: number, y: number, hex: string, tolerance?: number): void;
};

export type LayoutCase = {
  /** Stable kebab-case id, unique across the corpus. Used as the report anchor. */
  id: string;
  /** Report section, e.g. "Main axis". */
  group: string;
  /** Card heading, e.g. `justifyContent: "space-between"`. */
  title: string;
  /** One line of prose for the report card. */
  note: string;
  /** Canvas size. Default [480, 240]. Keep small: cost is per pixel. */
  size?: [number, number];
  /** Builds the scene into a root Block already sized to the canvas. Shown verbatim in the report. */
  build: (root: Block, seq: Sequence) => void;
  /** Frames to assert at. Default [1]. */
  frames?: number[];
  /** Assertions. Throwing (via vitest `expect`) records a failure; it does not abort the run. */
  expect: (probe: CaseProbe, frame: number) => void;
  /**
   * Set when this case knowingly diverges from CSS (a flexily workaround or a
   * deliberate canvas-specific choice). Rendered as a badge in the report.
   */
  divergence?: string;
};

export type CaseResult = {
  case: LayoutCase;
  /** PNG data URI of the last asserted frame. */
  png: string;
  /** Every named node's stage-space box at the last asserted frame. */
  geometry: Record<string, Rect>;
  /** Dedented `build.toString()` — the code the report shows. */
  source: string;
  /** Empty when the case passed. */
  failures: string[];
};
