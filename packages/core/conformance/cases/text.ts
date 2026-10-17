import { expect } from "vitest";
import { Block, measure, Text } from "../../src/index.js";
import type { LayoutCase } from "../types.js";

const PROSE =
  "Layout that reflows every tick keeps a composition honest, because the text " +
  "decides how tall the box is and the box decides where everything else lands.";

/**
 * These cases run against whatever face skia resolves for the default family,
 * and glyph metrics differ between machines. Assert structure — line counts,
 * containment, monotonic relationships — never exact glyph widths.
 */
export const textCases: LayoutCase[] = [
  {
    id: "text-wrap-to-available",
    group: "Text",
    title: "text wraps to the width it is given",
    note: "A paragraph in a padded column wraps inside the content box and reports its real line count.",
    build: (root) => {
      root.setAttrs({ flexDirection: "column", padding: 20 });
      root.add(new Text({ name: "t", text: PROSE, fontSize: 18, fill: "#e6edf3" }));
    },
    expect: (p) => {
      const box = p.box(".t");
      expect(box.width).toBeLessThanOrEqual(440.5);
      expect(box.x).toBeCloseTo(20, 0);
      const lines = measure(p.node(".t")).lines ?? [];
      expect(lines.length).toBeGreaterThanOrEqual(3);
      // Every line must sit inside the content box.
      for (const line of lines) expect(line.x + line.width).toBeLessThanOrEqual(460.5);
    },
  },
  {
    id: "text-hug-in-row",
    group: "Text",
    title: "text hugs its glyphs in a row",
    note: "In a row, a short label takes only the width it needs, and its sibling starts right after it.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(new Text({ name: "t", text: "Hello", fontSize: 24, fill: "#e6edf3" }));
      root.add(new Block({ name: "after", width: 100, height: 40, background: "#4ea1ff" }));
    },
    expect: (p) => {
      const t = p.box(".t");
      expect(t.width).toBeGreaterThan(0);
      expect(t.width).toBeLessThan(200);
      expect(p.box(".after").x).toBeCloseTo(t.width, 0);
    },
  },
  {
    id: "text-in-column-parent",
    group: "Text",
    title: "text in a column parent",
    note: "A column's cross axis is the wrap width, which the measure function reads from a different argument.",
    build: (root) => {
      root.setAttrs({ flexDirection: "column", alignItems: "flex-start" });
      root.add(new Text({ name: "t", text: "One short line", fontSize: 24, fill: "#e6edf3" }));
    },
    expect: (p) => {
      const box = p.box(".t");
      expect(box.width).toBeGreaterThan(0);
      expect(box.width).toBeLessThanOrEqual(480);
      expect((measure(p.node(".t")).lines ?? []).length).toBe(1);
    },
  },
  {
    id: "text-fit-to-box",
    group: "Text",
    title: "fitText sizes the font to the box",
    note: "Binary-searches a font size between min and max so the text fills its 300x60 box without spilling.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(
        new Text({
          name: "t",
          text: "Fit me",
          width: 300,
          height: 60,
          fitText: { min: 8, max: 96 },
          fill: "#e6edf3",
        }),
      );
    },
    expect: (p) => {
      const node = p.node(".t") as Text;
      // fontSize() reads back the size the glyphs actually render at.
      expect(node.fontSize()).toBeGreaterThan(8);
      expect(node.fontSize()).toBeLessThanOrEqual(96);
      expect(p.box(".t").width).toBeLessThanOrEqual(300.5);
    },
  },
  {
    id: "text-max-lines",
    group: "Text",
    title: "maxLines clamps with an ellipsis",
    note: "A paragraph that would wrap to many lines is cut to two and ellipsised.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(
        new Text({
          name: "t",
          text: PROSE,
          width: 300,
          fontSize: 18,
          maxLines: 2,
          ellipsis: true,
          fill: "#e6edf3",
        }),
      );
    },
    expect: (p) => {
      expect((measure(p.node(".t")).lines ?? []).length).toBe(2);
    },
  },
  {
    id: "text-beside-growing-sibling",
    group: "Text",
    title: "text beside a growing sibling",
    note: "The label hugs, and the flexGrow sibling takes exactly what is left of the row.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(new Text({ name: "t", text: "Label", fontSize: 24, fill: "#e6edf3" }));
      root.add(new Block({ name: "rest", flexGrow: 1, height: 40, background: "#4ea1ff" }));
    },
    expect: (p) => {
      const t = p.box(".t");
      const rest = p.box(".rest");
      expect(rest.x).toBeCloseTo(t.width, 0);
      expect(t.width + rest.width).toBeCloseTo(480, 0);
    },
  },
];
