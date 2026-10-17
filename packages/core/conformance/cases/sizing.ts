import { expect } from "vitest";
import { Block, Flex } from "../../src/index.js";
import type { LayoutCase } from "../types.js";

export const sizingCases: LayoutCase[] = [
  {
    id: "size-px",
    group: "Sizing",
    title: "width and height in pixels",
    note: "A plain numeric size is used as-is.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row" });
      root.add(new Block({ name: "box", width: 200, height: 80, background: "#4ea1ff" }));
    },
    expect: (p) => {
      expect(p.box(".box")).toMatchObject({ x: 0, y: 0, width: 200, height: 80 });
    },
  },
  {
    id: "size-percent",
    group: "Sizing",
    title: 'width: "50%", height: "25%"',
    note: "Percent sizes resolve against the parent's content box — here the full 480x240 canvas.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row" });
      root.add(new Block({ name: "box", width: "50%", height: "25%", background: "#4ea1ff" }));
    },
    expect: (p) => {
      expect(p.box(".box").width).toBeCloseTo(240, 0);
      expect(p.box(".box").height).toBeCloseTo(60, 0);
    },
  },
  {
    id: "size-hug-block",
    group: "Sizing",
    title: "hug content (Block)",
    note:
      "A Block with no width or height sizes to its children plus its own padding. " +
      "The parent needs a non-stretch alignItems, or the cross axis fills instead of hugging.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      const hug = new Block({ name: "hug", padding: 10, background: "#1f2937" });
      hug.add(new Block({ name: "inner", width: 100, height: 60, background: "#4ea1ff" }));
      root.add(hug);
    },
    expect: (p) => {
      expect(p.box(".hug").width).toBeCloseTo(120, 0);
      expect(p.box(".hug").height).toBeCloseTo(80, 0);
      expect(p.box(".inner")).toMatchObject({ x: 10, y: 10 });
    },
  },
  {
    id: "size-hug-flex",
    group: "Sizing",
    title: "hug content (Flex)",
    note: "The same shape built with Flex, which paints nothing and only lays out.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      const hug = new Flex({ name: "hugflex", padding: 10 });
      hug.add(new Block({ name: "inner", width: 100, height: 60, background: "#4ea1ff" }));
      root.add(hug);
    },
    expect: (p) => {
      // The child must land in the right place regardless.
      expect(p.box(".inner")).toMatchObject({ x: 10, y: 10 });
      // ...and the container should report the size it hugged to.
      expect(p.box(".hugflex").width).toBeCloseTo(120, 0);
      expect(p.box(".hugflex").height).toBeCloseTo(80, 0);
    },
  },
  {
    id: "size-grow-equal",
    group: "Sizing",
    title: "flexGrow splits free space evenly",
    note: "Two children with flexBasis 0 and equal grow each take half the row.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row" });
      root.add(
        new Block({ name: "a", flexBasis: 0, flexGrow: 1, height: 80, background: "#4ea1ff" }),
      );
      root.add(
        new Block({ name: "b", flexBasis: 0, flexGrow: 1, height: 80, background: "#7ee787" }),
      );
    },
    expect: (p) => {
      expect(p.box(".a").width).toBeCloseTo(240, 0);
      expect(p.box(".b").width).toBeCloseTo(240, 0);
      expect(p.box(".b").x).toBeCloseTo(240, 0);
    },
  },
  {
    id: "size-grow-ratio",
    group: "Sizing",
    title: "flexGrow distributes in proportion",
    note: "With flexBasis 0, a grow of 1 against 2 splits the row one-third to two-thirds.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row" });
      root.add(
        new Block({ name: "a", flexBasis: 0, flexGrow: 1, height: 80, background: "#4ea1ff" }),
      );
      root.add(
        new Block({ name: "b", flexBasis: 0, flexGrow: 2, height: 80, background: "#7ee787" }),
      );
    },
    expect: (p) => {
      expect(p.box(".a").width).toBeCloseTo(160, 0);
      expect(p.box(".b").width).toBeCloseTo(320, 0);
      expect(p.box(".b").x).toBeCloseTo(160, 0);
    },
  },
  {
    id: "size-shrink-equal",
    group: "Sizing",
    title: "flexShrink absorbs overflow evenly",
    note: "Two 200px children in a 300px row overflow by 100, and equal shrink splits it.",
    size: [300, 240],
    build: (root) => {
      root.setAttrs({ flexDirection: "row" });
      root.add(
        new Block({ name: "a", width: 200, height: 80, flexShrink: 1, background: "#4ea1ff" }),
      );
      root.add(
        new Block({ name: "b", width: 200, height: 80, flexShrink: 1, background: "#7ee787" }),
      );
    },
    expect: (p) => {
      expect(p.box(".a").width).toBeCloseTo(150, 0);
      expect(p.box(".b").width).toBeCloseTo(150, 0);
      expect(p.box(".b").x).toBeCloseTo(150, 0);
    },
  },
  {
    id: "size-shrink-zero",
    group: "Sizing",
    title: "flexShrink: 0 refuses to shrink",
    note: "The rigid child keeps its 200px, so its sibling absorbs the whole 100px overflow.",
    size: [300, 240],
    build: (root) => {
      root.setAttrs({ flexDirection: "row" });
      root.add(
        new Block({ name: "a", width: 200, height: 80, flexShrink: 0, background: "#4ea1ff" }),
      );
      root.add(
        new Block({ name: "b", width: 200, height: 80, flexShrink: 1, background: "#7ee787" }),
      );
    },
    expect: (p) => {
      expect(p.box(".a").width).toBeCloseTo(200, 0);
      expect(p.box(".b").width).toBeCloseTo(100, 0);
    },
  },
  {
    id: "size-basis",
    group: "Sizing",
    title: "flexBasis overrides width on the main axis",
    note: "flexBasis is the starting main size, so the 250 wins over the 100.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row" });
      root.add(
        new Block({ name: "box", width: 100, height: 80, flexBasis: 250, background: "#4ea1ff" }),
      );
    },
    expect: (p) => {
      expect(p.box(".box").width).toBeCloseTo(250, 0);
    },
  },
];
