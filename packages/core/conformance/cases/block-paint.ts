import { expect } from "vitest";
import { Block } from "../../src/index.js";
import { PAGE_BG } from "../harness.js";
import type { LayoutCase } from "../types.js";

/**
 * Every paint case centres one 240x120 card in the 480x240 canvas, so the card
 * spans x 120..360 and y 60..180, with its centre at (240, 120). Probe points
 * below are derived from that rectangle.
 */
function card(root: Block, config: Record<string, unknown>): void {
  root.setAttrs({ flexDirection: "row", justifyContent: "center", alignItems: "center" });
  root.add(new Block({ name: "card", width: 240, height: 120, ...config }));
}

export const blockPaintCases: LayoutCase[] = [
  {
    id: "paint-solid",
    group: "Block paint",
    title: "background: a solid colour",
    note: "The card paints its background through an internal rect, sized to the layout box.",
    build: (root) => {
      card(root, { background: "#4ea1ff" });
    },
    expect: (p) => {
      expect(p.box(".card")).toMatchObject({ x: 120, y: 60, width: 240, height: 120 });
      p.expectColor(240, 120, "#4ea1ff");
      p.expectColor(10, 10, PAGE_BG);
    },
  },
  {
    id: "paint-gradient-linear",
    group: "Block paint",
    title: "background: a linear gradient",
    note: "An angle of 90 degrees runs the gradient top to bottom across the card.",
    build: (root) => {
      card(root, {
        background: {
          gradient: {
            type: "linear",
            stops: [
              [0, "#1f2937"],
              [1, "#7ee787"],
            ],
            angle: 90,
          },
        },
      });
    },
    expect: (p) => {
      const top = p.at(240, 70);
      const bottom = p.at(240, 170);
      expect(top).not.toBe(bottom);
      expect(top).not.toBe(PAGE_BG);
      expect(bottom).not.toBe(PAGE_BG);
    },
  },
  {
    id: "paint-gradient-angle",
    group: "Block paint",
    title: "gradient angle rotates the axis",
    note: "The same stops at 0 degrees run left to right instead.",
    build: (root) => {
      card(root, {
        background: {
          gradient: {
            type: "linear",
            stops: [
              [0, "#1f2937"],
              [1, "#7ee787"],
            ],
            angle: 0,
          },
        },
      });
    },
    expect: (p) => {
      expect(p.at(130, 120)).not.toBe(p.at(350, 120));
      // Rotating the axis means the vertical extremes now match.
      expect(p.at(240, 70)).toBe(p.at(240, 170));
    },
  },
  {
    id: "paint-gradient-radial",
    group: "Block paint",
    title: "background: a radial gradient",
    note: "A radial gradient runs from the card's centre out to half its longest side.",
    build: (root) => {
      card(root, {
        background: {
          gradient: {
            type: "radial",
            stops: [
              [0, "#7ee787"],
              [1, "#1f2937"],
            ],
          },
        },
      });
    },
    expect: (p) => {
      p.expectColor(240, 120, "#7ee787", 12);
      expect(p.at(126, 66)).not.toBe(p.at(240, 120));
    },
  },
  {
    id: "paint-border-uniform",
    group: "Block paint",
    title: "borderSize and borderColor",
    note: "A border paints inside the box, as CSS does — a 6px border occupies the first 6px, never overhanging.",
    build: (root) => {
      card(root, { background: "#101820", borderSize: 6, borderColor: "#ff6b4e" });
    },
    expect: (p) => {
      // The card spans x 120..360, y 60..180, so the border bands are the first
      // 6px inside each edge, and one pixel outside is still the page.
      p.expectColor(240, 63, "#ff6b4e");
      p.expectColor(123, 120, "#ff6b4e");
      p.expectColor(240, 57, PAGE_BG);
      p.expectColor(240, 120, "#101820");
    },
  },
  {
    id: "paint-border-per-edge-colour",
    group: "Block paint",
    title: "borderColor per edge",
    note: "borderColor takes [top, right, bottom, left], and each edge paints its own colour, mitred at the corners.",
    build: (root) => {
      card(root, {
        background: "#101820",
        borderSize: 6,
        borderColor: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
      });
    },
    expect: (p) => {
      p.expectColor(240, 63, "#ff0000");
      p.expectColor(357, 120, "#00ff00");
      p.expectColor(240, 177, "#0000ff");
      p.expectColor(123, 120, "#ffff00");
    },
  },
  {
    id: "paint-border-per-edge-size",
    group: "Block paint",
    title: "borderSize per edge",
    note: "borderSize takes the same four edges, so a top-only border leaves the other three bare.",
    build: (root) => {
      card(root, { background: "#101820", borderSize: [12, 0, 0, 0], borderColor: "#ff6b4e" });
    },
    expect: (p) => {
      p.expectColor(240, 63, "#ff6b4e");
      // The other three edges carry no border, so they show the card's own background.
      p.expectColor(357, 120, "#101820");
      p.expectColor(240, 177, "#101820");
      p.expectColor(123, 120, "#101820");
    },
  },
  {
    id: "paint-border-dashed",
    group: "Block paint",
    title: 'borderStyle: "dashed"',
    note: "A dashed border alternates painted and bare stretches along the same outline.",
    build: (root) => {
      card(root, {
        background: "#101820",
        borderSize: 4,
        borderColor: "#ff6b4e",
        borderStyle: "dashed",
      });
    },
    expect: (p) => {
      const samples: string[] = [];
      for (let x = 130; x <= 350; x += 5) samples.push(p.at(x, 62));
      expect(samples.some((s) => s === "#ff6b4e")).toBe(true);
      expect(samples.some((s) => s !== "#ff6b4e")).toBe(true);
    },
  },
  {
    id: "paint-corner-radius",
    group: "Block paint",
    title: "cornerRadius rounds the background",
    note: "The corner pixel shows the page behind, while the mid-edge and centre stay painted.",
    build: (root) => {
      card(root, { background: "#4ea1ff", cornerRadius: 24 });
    },
    expect: (p) => {
      p.expectColor(123, 63, PAGE_BG);
      p.expectColor(240, 62, "#4ea1ff");
      p.expectColor(240, 120, "#4ea1ff");
    },
  },
  {
    id: "paint-corner-radius-per-corner",
    group: "Block paint",
    title: "cornerRadius per corner",
    note: "An array rounds each corner independently, clockwise from the top left.",
    build: (root) => {
      card(root, { background: "#4ea1ff", cornerRadius: [24, 0, 0, 0] });
    },
    expect: (p) => {
      p.expectColor(123, 63, PAGE_BG);
      p.expectColor(357, 63, "#4ea1ff");
      p.expectColor(357, 177, "#4ea1ff");
    },
  },
  {
    id: "paint-border-layout-space",
    group: "Block paint",
    title: "a border takes layout space",
    note: "Like CSS, the border insets the content box: a 20px border on a 240x120 card leaves 200x80 for children.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", justifyContent: "center", alignItems: "center" });
      const outer = new Block({
        name: "card",
        flexDirection: "row",
        width: 240,
        height: 120,
        background: "#101820",
        borderSize: 20,
        borderColor: "#ff6b4e",
      });
      outer.add(new Block({ name: "child", width: "100%", height: "100%", background: "#4ea1ff" }));
      root.add(outer);
    },
    expect: (p) => {
      // The card keeps its declared size (flexily sizes border-box)...
      expect(p.box(".card")).toMatchObject({ x: 120, y: 60, width: 240, height: 120 });
      // ...and the child is inset by the border on every edge.
      expect(p.box(".child")).toMatchObject({ x: 140, y: 80, width: 200, height: 80 });
      p.expectColor(130, 120, "#ff6b4e");
      p.expectColor(240, 120, "#4ea1ff");
    },
  },
  {
    id: "paint-border-per-edge-rounded",
    group: "Block paint",
    title: "per-edge colours with a corner radius",
    note: "Differing edges are clipped to the rounded silhouette, so the corners round and the mid-edges keep their colours.",
    build: (root) => {
      card(root, {
        background: "#101820",
        borderSize: 8,
        borderColor: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
        cornerRadius: 24,
      });
    },
    expect: (p) => {
      p.expectColor(240, 63, "#ff0000");
      p.expectColor(356, 120, "#00ff00");
      p.expectColor(240, 177, "#0000ff");
      p.expectColor(124, 120, "#ffff00");
      // The corner is cut away by the radius.
      p.expectColor(123, 63, PAGE_BG);
    },
  },
  {
    id: "paint-border-per-edge-dashed",
    group: "Block paint",
    title: "dashes need a uniform border",
    note: "borderStyle: dashed applies to a uniform border. Edges that differ are painted as solid mitred bands.",
    divergence:
      "A dashed border is stroked along one path, which per-edge painting replaces with four filled polygons. Combining dashes with differing edges paints solid rather than failing, so the border is still visible.",
    build: (root) => {
      card(root, {
        background: "#101820",
        borderSize: [8, 2, 8, 2],
        borderColor: "#ff6b4e",
        borderStyle: "dashed",
      });
    },
    expect: (p) => {
      const samples: string[] = [];
      for (let x = 130; x <= 350; x += 5) samples.push(p.at(x, 63));
      expect(samples.every((s) => s === "#ff6b4e")).toBe(true);
    },
  },
  {
    id: "paint-shadow",
    group: "Block paint",
    title: "shadow",
    note: "An offset, blurred shadow darkens the page below the card without touching the far corner.",
    build: (root) => {
      card(root, {
        background: "#4ea1ff",
        shadow: { color: "#000000", blur: 16, offsetY: 8, opacity: 0.6 },
      });
    },
    expect: (p) => {
      expect(p.at(240, 188)).not.toBe(PAGE_BG);
      p.expectColor(10, 10, PAGE_BG);
    },
  },
];
