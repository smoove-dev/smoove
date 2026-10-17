import { expect } from "vitest";
import { Block } from "../../src/index.js";
import { PAGE_BG } from "../harness.js";
import type { LayoutCase } from "../types.js";

export const nestingCases: LayoutCase[] = [
  {
    id: "nest-three-deep",
    group: "Nesting and hug",
    title: "three levels of nested padding",
    note: "Each level's padding accumulates on the way in, and each container hugs on the way out.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start", padding: 20 });
      const outer = new Block({
        name: "outer",
        flexDirection: "row",
        alignItems: "flex-start",
        padding: 10,
        background: "#1f2937",
      });
      const inner = new Block({
        name: "inner",
        flexDirection: "row",
        alignItems: "flex-start",
        padding: 5,
        background: "#374151",
      });
      inner.add(new Block({ name: "leaf", width: 60, height: 40, background: "#4ea1ff" }));
      outer.add(inner);
      root.add(outer);
    },
    expect: (p) => {
      // Positions accumulate: 20 + 10 + 5.
      expect(p.box(".leaf")).toMatchObject({ x: 35, y: 35 });
      // Sizes hug outward: leaf 60x40, +5 padding, +10 padding.
      expect(p.box(".inner").width).toBeCloseTo(70, 0);
      expect(p.box(".inner").height).toBeCloseTo(50, 0);
      expect(p.box(".outer").width).toBeCloseTo(90, 0);
      expect(p.box(".outer").height).toBeCloseTo(70, 0);
    },
  },
  {
    id: "nest-percent-of-content-box",
    group: "Nesting and hug",
    title: "percent resolves against the content box",
    note: "A 50% child of a padded 480px parent is 230, not 240 — padding comes off first.",
    build: (root) => {
      root.setAttrs({ flexDirection: "column" });
      const panel = new Block({
        name: "panel",
        flexDirection: "row",
        padding: 10,
        background: "#1f2937",
        height: 100,
      });
      panel.add(new Block({ name: "child", width: "50%", height: 40, background: "#4ea1ff" }));
      root.add(panel);
    },
    expect: (p) => {
      expect(p.box(".panel").width).toBeCloseTo(480, 0);
      expect(p.box(".child").width).toBeCloseTo(230, 0);
      expect(p.box(".child").x).toBeCloseTo(10, 0);
    },
  },
  {
    id: "nest-align-centre-in-hug",
    group: "Nesting and hug",
    title: "alignItems: center inside a hug-height row",
    note: "Centring on a cross axis that hugs its tallest child — the case flexily gets wrong and smoove patches.",
    build: (root) => {
      root.setAttrs({ flexDirection: "column" });
      const row = new Block({
        name: "row",
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
      });
      row.add(new Block({ name: "short", width: 50, height: 20, background: "#4ea1ff" }));
      row.add(new Block({ name: "tall", width: 50, height: 30, background: "#7ee787" }));
      root.add(row);
    },
    expect: (p) => {
      // Hug height is the tallest child (30); the short one centres at (30-20)/2.
      expect(p.box(".short").y).toBe(5);
      expect(p.box(".tall").y).toBe(0);
      expect(p.box(".short").x).toBe(0);
      expect(p.box(".tall").x).toBe(50);
    },
  },
  {
    id: "nest-grow-spacer",
    group: "Nesting and hug",
    title: "an empty flexGrow spacer",
    note: "A sizeless child with flexGrow: 1 eats the free space and pushes its sibling to the far edge.",
    build: (root) => {
      root.setAttrs({ flexDirection: "column" });
      const header = new Block({
        name: "header",
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        height: 60,
      });
      header.add(new Block({ name: "left", width: 80, height: 30, background: "#4ea1ff" }));
      header.add(new Block({ name: "spacer", flexGrow: 1 }));
      header.add(new Block({ name: "right", width: 80, height: 30, background: "#ff6b4e" }));
      root.add(header);
    },
    expect: (p) => {
      expect(p.box(".left").x).toBe(0);
      expect(p.box(".right").x).toBeCloseTo(400, 0);
      expect(Number.isFinite(p.box(".right").y)).toBe(true);
    },
  },
  {
    id: "nest-hug-background",
    group: "Nesting and hug",
    title: "a hug-content card still paints",
    note: "A Block with no size paints its background at the size it hugged to, not at 0x0.",
    build: (root) => {
      root.setAttrs({ flexDirection: "column", alignItems: "flex-start" });
      const cardNode = new Block({
        name: "card",
        padding: 16,
        background: "#4ea1ff",
        cornerRadius: 8,
      });
      cardNode.add(new Block({ name: "inner", width: 100, height: 60, background: "#101820" }));
      root.add(cardNode);
    },
    expect: (p) => {
      expect(p.box(".card").width).toBeCloseTo(132, 0);
      expect(p.box(".card").height).toBeCloseTo(92, 0);
      // It really paints: a pixel inside the padding band is the card colour.
      p.expectColor(8, 45, "#4ea1ff");
      p.expectColor(400, 200, PAGE_BG);
    },
  },
  {
    id: "nest-justify-in-hug-main",
    group: "Nesting and hug",
    title: "justifyContent inside a hug-width row",
    note: "With no free space to distribute, space-between packs the children flush — and must not go NaN.",
    build: (root) => {
      root.setAttrs({ flexDirection: "column", alignItems: "flex-start" });
      const hug = new Block({
        name: "hug",
        flexDirection: "row",
        justifyContent: "space-between",
        background: "#1f2937",
      });
      hug.add(new Block({ name: "a", width: 60, height: 40, background: "#4ea1ff" }));
      hug.add(new Block({ name: "b", width: 60, height: 40, background: "#7ee787" }));
      root.add(hug);
    },
    expect: (p) => {
      expect(p.box(".hug").width).toBeCloseTo(120, 0);
      expect(p.box(".a").x).toBe(0);
      expect(p.box(".b").x).toBe(60);
    },
  },
];
