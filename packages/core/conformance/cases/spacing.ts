import { expect } from "vitest";
import { Block } from "../../src/index.js";
import type { LayoutCase } from "../types.js";

export const spacingCases: LayoutCase[] = [
  {
    id: "gap-row",
    group: "Spacing",
    title: "gap in a row",
    note: "A gap of 30 adds 30px between each pair of children, not around them.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", gap: 30 });
      root.add(new Block({ name: "a", width: 100, height: 60, background: "#4ea1ff" }));
      root.add(new Block({ name: "b", width: 100, height: 60, background: "#7ee787" }));
      root.add(new Block({ name: "c", width: 100, height: 60, background: "#ff6b4e" }));
    },
    expect: (p) => {
      expect(p.box(".a").x).toBe(0);
      expect(p.box(".b").x).toBe(130);
      expect(p.box(".c").x).toBe(260);
    },
  },
  {
    id: "gap-column",
    group: "Spacing",
    title: "gap in a column",
    note: "The same gap applies along whichever axis is the main one.",
    build: (root) => {
      root.setAttrs({ flexDirection: "column", gap: 30 });
      root.add(new Block({ name: "a", width: 100, height: 60, background: "#4ea1ff" }));
      root.add(new Block({ name: "b", width: 100, height: 60, background: "#7ee787" }));
      root.add(new Block({ name: "c", width: 100, height: 60, background: "#ff6b4e" }));
    },
    expect: (p) => {
      expect(p.box(".a").y).toBe(0);
      expect(p.box(".b").y).toBe(90);
      expect(p.box(".c").y).toBe(180);
    },
  },
  {
    id: "padding-number",
    group: "Spacing",
    title: "padding: 20",
    note: "A single number pads all four edges, shrinking the content box to 440x200.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", padding: 20 });
      root.add(new Block({ name: "fill", width: "100%", height: 60, background: "#4ea1ff" }));
    },
    expect: (p) => {
      expect(p.box(".fill")).toMatchObject({ x: 20, y: 20 });
      expect(p.box(".fill").width).toBeCloseTo(440, 0);
    },
  },
  {
    id: "padding-pair",
    group: "Spacing",
    title: "padding: [10, 20]",
    note: "A two-tuple is [vertical, horizontal], the same shorthand CSS uses.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", padding: [10, 20] });
      root.add(new Block({ name: "fill", width: "100%", height: 60, background: "#4ea1ff" }));
    },
    expect: (p) => {
      expect(p.box(".fill")).toMatchObject({ x: 20, y: 10 });
      expect(p.box(".fill").width).toBeCloseTo(440, 0);
    },
  },
  {
    id: "padding-quad",
    group: "Spacing",
    title: "padding: [5, 10, 15, 20]",
    note: "A four-tuple is [top, right, bottom, left], clockwise from the top like CSS.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", padding: [5, 10, 15, 20] });
      root.add(new Block({ name: "fill", width: "100%", height: "100%", background: "#4ea1ff" }));
    },
    expect: (p) => {
      expect(p.box(".fill")).toMatchObject({ x: 20, y: 5 });
      expect(p.box(".fill").width).toBeCloseTo(450, 0);
      expect(p.box(".fill").height).toBeCloseTo(220, 0);
    },
  },
  {
    id: "padding-object",
    group: "Spacing",
    title: "padding: { top, left }",
    note: "The object form sets only the edges you name; the rest stay zero.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", padding: { top: 8, left: 12 } });
      root.add(new Block({ name: "box", width: 100, height: 60, background: "#4ea1ff" }));
    },
    expect: (p) => {
      expect(p.box(".box")).toMatchObject({ x: 12, y: 8 });
    },
  },
  {
    id: "margin-child",
    group: "Spacing",
    title: "margin on a child",
    note: "Margin is outside the child's box, so it offsets the child and pushes its sibling along.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(new Block({ name: "a", width: 100, height: 60, margin: 20, background: "#4ea1ff" }));
      root.add(new Block({ name: "b", width: 100, height: 60, background: "#7ee787" }));
    },
    expect: (p) => {
      expect(p.box(".a")).toMatchObject({ x: 20, y: 20 });
      expect(p.box(".b").x).toBe(140);
    },
  },
  {
    id: "margin-quad",
    group: "Spacing",
    title: "margin: [5, 10, 15, 20]",
    note: "Margin takes the same four-edge notations as padding.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(
        new Block({
          name: "a",
          width: 100,
          height: 60,
          margin: [5, 10, 15, 20],
          background: "#4ea1ff",
        }),
      );
      root.add(new Block({ name: "b", width: 100, height: 60, background: "#7ee787" }));
    },
    expect: (p) => {
      expect(p.box(".a")).toMatchObject({ x: 20, y: 5 });
      expect(p.box(".b").x).toBe(130);
    },
  },
  {
    id: "margin-centre",
    group: "Spacing",
    title: "margin counts when centring",
    note: "justifyContent centres the child's outer box (140 wide), then the left margin offsets it.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", justifyContent: "center", alignItems: "flex-start" });
      root.add(new Block({ name: "a", width: 100, height: 60, margin: 20, background: "#4ea1ff" }));
    },
    expect: (p) => {
      expect(p.box(".a").x).toBeCloseTo(190, 0);
    },
  },
];
