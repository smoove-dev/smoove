import { expect } from "vitest";
import { type Align, type AlignSelf, Block } from "../../src/index.js";
import type { LayoutCase } from "../types.js";

/**
 * Row fixture: three tiles of differing heights in a 480x240 container, so the
 * cross axis (y) has something to distribute. Heights 40/80/120 against a 240
 * container give centre offsets of 100/80/60 and end offsets of 200/160/120.
 */
function unevenRow(root: Block): void {
  root.add(new Block({ name: "a", width: 100, height: 40, background: "#4ea1ff" }));
  root.add(new Block({ name: "b", width: 100, height: 80, background: "#7ee787" }));
  root.add(new Block({ name: "c", width: 100, height: 120, background: "#ff6b4e" }));
}

/** Column fixture: the cross axis is x, so the widths differ instead. */
function unevenColumn(root: Block): void {
  root.add(new Block({ name: "a", width: 40, height: 60, background: "#4ea1ff" }));
  root.add(new Block({ name: "b", width: 80, height: 60, background: "#7ee787" }));
  root.add(new Block({ name: "c", width: 120, height: 60, background: "#ff6b4e" }));
}

const ROW_Y: Record<"flex-start" | "center" | "flex-end", [number, number, number]> = {
  "flex-start": [0, 0, 0],
  center: [100, 80, 60],
  "flex-end": [200, 160, 120],
};

const COLUMN_X: Record<"flex-start" | "center" | "flex-end", [number, number, number]> = {
  "flex-start": [0, 0, 0],
  center: [220, 200, 180],
  "flex-end": [440, 400, 360],
};

const ALIGN_NOTES: Record<Align, string> = {
  "flex-start": "Children pin to the start of the cross axis, whatever their size.",
  center: "Children of different sizes centre on the cross axis.",
  "flex-end": "Children pin to the end of the cross axis.",
  stretch: "Children with no cross size fill the container's cross axis.",
};

function alignRowCase(align: "flex-start" | "center" | "flex-end"): LayoutCase {
  const [a, b, c] = ROW_Y[align];
  return {
    id: `align-items-${align}-row`,
    group: "Cross axis",
    title: `alignItems: "${align}" (row)`,
    note: ALIGN_NOTES[align],
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: align });
      unevenRow(root);
    },
    expect: (p) => {
      expect(p.box(".a").y).toBeCloseTo(a, 0);
      expect(p.box(".b").y).toBeCloseTo(b, 0);
      expect(p.box(".c").y).toBeCloseTo(c, 0);
    },
  };
}

function alignColumnCase(align: "flex-start" | "center" | "flex-end"): LayoutCase {
  const [a, b, c] = COLUMN_X[align];
  return {
    id: `align-items-${align}-column`,
    group: "Cross axis",
    title: `alignItems: "${align}" (column)`,
    note: `${ALIGN_NOTES[align]} In a column the cross axis is horizontal.`,
    build: (root) => {
      root.setAttrs({ flexDirection: "column", alignItems: align });
      unevenColumn(root);
    },
    expect: (p) => {
      expect(p.box(".a").x).toBeCloseTo(a, 0);
      expect(p.box(".b").x).toBeCloseTo(b, 0);
      expect(p.box(".c").x).toBeCloseTo(c, 0);
    },
  };
}

const ALIGN_SELF: Record<AlignSelf, { y: number; height: number }> = {
  auto: { y: 0, height: 60 },
  "flex-start": { y: 0, height: 60 },
  center: { y: 90, height: 60 },
  "flex-end": { y: 180, height: 60 },
  stretch: { y: 0, height: 240 },
};

function alignSelfCase(self: AlignSelf): LayoutCase {
  const exp = ALIGN_SELF[self];
  return {
    id: `align-self-${self}`,
    group: "Cross axis",
    title: `alignSelf: "${self}"`,
    note: `Only the middle tile opts out of the container's alignItems. ${
      self === "stretch"
        ? "A stretched child must have no explicit cross size."
        : "Its siblings stay where alignItems put them."
    }`,
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(new Block({ name: "a", width: 100, height: 60, background: "#4ea1ff" }));
      root.add(
        self === "stretch"
          ? new Block({ name: "b", width: 100, alignSelf: self, background: "#7ee787" })
          : new Block({
              name: "b",
              width: 100,
              height: 60,
              alignSelf: self,
              background: "#7ee787",
            }),
      );
      root.add(new Block({ name: "c", width: 100, height: 60, background: "#ff6b4e" }));
    },
    expect: (p) => {
      expect(p.box(".b").y).toBeCloseTo(exp.y, 0);
      expect(p.box(".b").height).toBeCloseTo(exp.height, 0);
      // alignSelf is per-child: the siblings must be untouched.
      expect(p.box(".a").y).toBe(0);
      expect(p.box(".c").y).toBe(0);
    },
  };
}

export const crossAxisCases: LayoutCase[] = [
  alignRowCase("flex-start"),
  alignRowCase("center"),
  alignRowCase("flex-end"),
  {
    id: "align-items-stretch-row",
    group: "Cross axis",
    title: 'alignItems: "stretch" (row)',
    note: "Children with no height fill the row's full 240px height.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "stretch", gap: 20 });
      root.add(new Block({ name: "a", width: 100, background: "#4ea1ff" }));
      root.add(new Block({ name: "b", width: 100, background: "#7ee787" }));
      root.add(new Block({ name: "c", width: 100, background: "#ff6b4e" }));
    },
    expect: (p) => {
      for (const box of p.boxes(".a, .b, .c")) {
        expect(box.height).toBeCloseTo(240, 0);
        expect(box.y).toBe(0);
      }
    },
  },
  alignColumnCase("flex-start"),
  alignColumnCase("center"),
  alignColumnCase("flex-end"),
  {
    id: "align-items-stretch-column",
    group: "Cross axis",
    title: 'alignItems: "stretch" (column)',
    note: "In a column, stretch fills the width instead.",
    build: (root) => {
      root.setAttrs({ flexDirection: "column", alignItems: "stretch", gap: 20 });
      root.add(new Block({ name: "a", height: 60, background: "#4ea1ff" }));
      root.add(new Block({ name: "b", height: 60, background: "#7ee787" }));
      root.add(new Block({ name: "c", height: 60, background: "#ff6b4e" }));
    },
    expect: (p) => {
      for (const box of p.boxes(".a, .b, .c")) {
        expect(box.width).toBeCloseTo(480, 0);
        expect(box.x).toBe(0);
      }
    },
  },
  {
    id: "align-items-default",
    group: "Cross axis",
    title: "alignItems defaults to stretch",
    note: "Leave alignItems off and children with no cross size fill it, exactly as in CSS.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", gap: 20 });
      root.add(new Block({ name: "a", width: 100, background: "#4ea1ff" }));
      root.add(new Block({ name: "b", width: 100, height: 60, background: "#7ee787" }));
    },
    expect: (p) => {
      // No height given: stretches. Height given: keeps it.
      expect(p.box(".a").height).toBeCloseTo(240, 0);
      expect(p.box(".b").height).toBeCloseTo(60, 0);
    },
  },
  alignSelfCase("auto"),
  alignSelfCase("flex-start"),
  alignSelfCase("center"),
  alignSelfCase("flex-end"),
  alignSelfCase("stretch"),
];
