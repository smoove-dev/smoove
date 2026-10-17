import { expect } from "vitest";
import { Block, type Justify } from "../../src/index.js";
import type { LayoutCase } from "../types.js";

/**
 * Three identical 100x60 tiles in a 480x240 container — the fixture every
 * main-axis case shares. Row free space is 480 - 300 = 180; column free space
 * is 240 - 180 = 60. Every expected number below is derived from those two.
 */
export function tiles(root: Block): void {
  root.add(new Block({ name: "a", width: 100, height: 60, background: "#4ea1ff" }));
  root.add(new Block({ name: "b", width: 100, height: 60, background: "#7ee787" }));
  root.add(new Block({ name: "c", width: 100, height: 60, background: "#ff6b4e" }));
}

type Expected = { a: number; b: number; c: number };

const NOTES: Record<Justify, string> = {
  "flex-start": "Items pack against the start edge in source order.",
  center: "Items pack as a group in the middle, free space split between the two ends.",
  "flex-end": "Items pack against the end edge.",
  "space-between": "First item on the start edge, last on the end edge, free space split between.",
  "space-around": "Each item gets an equal share of free space, half of it on each side.",
  "space-evenly": "Every gap is equal, including the two outer ones.",
};

// Row: a.x, b.x, c.x. Cross axis stays 0 (default alignItems: "flex-start").
const ROW: Record<Justify, Expected> = {
  "flex-start": { a: 0, b: 100, c: 200 },
  center: { a: 90, b: 190, c: 290 },
  "flex-end": { a: 180, b: 280, c: 380 },
  "space-between": { a: 0, b: 190, c: 380 },
  "space-around": { a: 30, b: 190, c: 350 },
  "space-evenly": { a: 45, b: 190, c: 335 },
};

// row-reverse packs from the opposite edge: the FIRST item lands on the right.
const ROW_REVERSE: Record<Justify, Expected> = {
  "flex-start": { a: 380, b: 280, c: 180 },
  center: { a: 290, b: 190, c: 90 },
  "flex-end": { a: 200, b: 100, c: 0 },
  "space-between": { a: 380, b: 190, c: 0 },
  "space-around": { a: 350, b: 190, c: 30 },
  "space-evenly": { a: 335, b: 190, c: 45 },
};

const COLUMN: Record<Justify, Expected> = {
  "flex-start": { a: 0, b: 60, c: 120 },
  center: { a: 30, b: 90, c: 150 },
  "flex-end": { a: 60, b: 120, c: 180 },
  "space-between": { a: 0, b: 90, c: 180 },
  "space-around": { a: 10, b: 90, c: 170 },
  "space-evenly": { a: 15, b: 90, c: 165 },
};

const COLUMN_REVERSE: Record<Justify, Expected> = {
  "flex-start": { a: 180, b: 120, c: 60 },
  center: { a: 150, b: 90, c: 30 },
  "flex-end": { a: 120, b: 60, c: 0 },
  "space-between": { a: 180, b: 90, c: 0 },
  "space-around": { a: 170, b: 90, c: 10 },
  "space-evenly": { a: 165, b: 90, c: 15 },
};

const JUSTIFY: Justify[] = [
  "flex-start",
  "center",
  "flex-end",
  "space-between",
  "space-around",
  "space-evenly",
];

function rowCase(justify: Justify, exp: Expected): LayoutCase {
  return {
    id: `row-${justify}`,
    group: "Main axis",
    title: `flexDirection: "row", justifyContent: "${justify}"`,
    note: NOTES[justify],
    build: (root) => {
      root.setAttrs({ flexDirection: "row", justifyContent: justify });
      tiles(root);
    },
    expect: (p) => {
      expect(p.box(".a").x).toBeCloseTo(exp.a, 0);
      expect(p.box(".b").x).toBeCloseTo(exp.b, 0);
      expect(p.box(".c").x).toBeCloseTo(exp.c, 0);
      expect(p.box(".a").y).toBe(0);
    },
  };
}

function rowReverseCase(justify: Justify, exp: Expected): LayoutCase {
  return {
    id: `row-reverse-${justify}`,
    group: "Main axis",
    title: `flexDirection: "row-reverse", justifyContent: "${justify}"`,
    note: `${NOTES[justify]} Reversed, so the start edge is the right one.`,
    build: (root) => {
      root.setAttrs({ flexDirection: "row-reverse", justifyContent: justify });
      tiles(root);
    },
    expect: (p) => {
      expect(p.box(".a").x).toBeCloseTo(exp.a, 0);
      expect(p.box(".b").x).toBeCloseTo(exp.b, 0);
      expect(p.box(".c").x).toBeCloseTo(exp.c, 0);
      expect(p.box(".a").y).toBe(0);
    },
  };
}

function columnCase(justify: Justify, exp: Expected): LayoutCase {
  return {
    id: `column-${justify}`,
    group: "Main axis",
    title: `flexDirection: "column", justifyContent: "${justify}"`,
    note: `${NOTES[justify]} The main axis is now vertical.`,
    build: (root) => {
      root.setAttrs({ flexDirection: "column", justifyContent: justify });
      tiles(root);
    },
    expect: (p) => {
      expect(p.box(".a").y).toBeCloseTo(exp.a, 0);
      expect(p.box(".b").y).toBeCloseTo(exp.b, 0);
      expect(p.box(".c").y).toBeCloseTo(exp.c, 0);
      expect(p.box(".a").x).toBe(0);
    },
  };
}

function columnReverseCase(justify: Justify, exp: Expected): LayoutCase {
  return {
    id: `column-reverse-${justify}`,
    group: "Main axis",
    title: `flexDirection: "column-reverse", justifyContent: "${justify}"`,
    note: `${NOTES[justify]} Reversed, so the start edge is the bottom one.`,
    build: (root) => {
      root.setAttrs({ flexDirection: "column-reverse", justifyContent: justify });
      tiles(root);
    },
    expect: (p) => {
      expect(p.box(".a").y).toBeCloseTo(exp.a, 0);
      expect(p.box(".b").y).toBeCloseTo(exp.b, 0);
      expect(p.box(".c").y).toBeCloseTo(exp.c, 0);
      expect(p.box(".a").x).toBe(0);
    },
  };
}

export const mainAxisCases: LayoutCase[] = [
  ...JUSTIFY.map((j) => rowCase(j, ROW[j])),
  ...JUSTIFY.map((j) => rowReverseCase(j, ROW_REVERSE[j])),
  ...JUSTIFY.map((j) => columnCase(j, COLUMN[j])),
  ...JUSTIFY.map((j) => columnReverseCase(j, COLUMN_REVERSE[j])),
];
