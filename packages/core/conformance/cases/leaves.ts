import Konva from "konva";
import { expect } from "vitest";
import { Block, Circle, Image, Star } from "../../src/index.js";
import { PAGE_BG, syntheticImage } from "../harness.js";
import type { LayoutCase } from "../types.js";

export const leafCases: LayoutCase[] = [
  {
    id: "leaf-circle-origin",
    group: "Mixed leaves",
    title: "a Circle lands its bounding box at the slot",
    note: "Konva draws circles from their centre; the wrapper corrects the origin so layout sees a box.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(new Circle({ name: "c", radius: 40, fill: "#4ea1ff" }));
      root.add(new Block({ name: "after", width: 100, height: 40, background: "#7ee787" }));
    },
    expect: (p) => {
      expect(p.box(".c")).toMatchObject({ x: 0, y: 0, width: 80, height: 80 });
      // The node's own x is the centre, 40 to the right of its box.
      expect((p.node(".c") as Circle).x()).toBe(40);
      expect(p.box(".after").x).toBe(80);
      // It really paints where the box says.
      p.expectColor(40, 40, "#4ea1ff");
    },
  },
  {
    id: "leaf-star",
    group: "Mixed leaves",
    title: "a Star reports its intrinsic size",
    note: "Points-based shapes measure through getSelfRect, so the row flows around them.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(
        new Star({ name: "s", numPoints: 5, innerRadius: 20, outerRadius: 40, fill: "#ff6b4e" }),
      );
      root.add(new Block({ name: "after", width: 100, height: 40, background: "#7ee787" }));
    },
    expect: (p) => {
      const star = p.box(".s");
      expect(star.width).toBeCloseTo(80, 0);
      expect(p.box(".after").x).toBeCloseTo(star.width, 0);
    },
  },
  {
    id: "leaf-image-intrinsic",
    group: "Mixed leaves",
    title: "an Image sizes to its bitmap",
    note: "With no width or height, an Image contributes its natural pixel dimensions to the layout.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(new Image({ name: "i", src: "synthetic", loader: syntheticImage(120, 80) }));
      root.add(new Block({ name: "after", width: 100, height: 40, background: "#7ee787" }));
    },
    expect: (p) => {
      expect(p.box(".i")).toMatchObject({ x: 0, y: 0, width: 120, height: 80 });
      expect(p.box(".after").x).toBe(120);
      // The helper paints its top-left quadrant in a second colour.
      p.expectColor(20, 20, "#ff6b4e");
      p.expectColor(100, 60, "#4ea1ff");
    },
  },
  {
    id: "leaf-image-object-fit",
    group: "Mixed leaves",
    title: 'Image objectFit: "cover"',
    note: "Given an explicit box, the bitmap fills it and crops rather than distorting.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(
        new Image({
          name: "i",
          width: 200,
          height: 80,
          objectFit: "cover",
          src: "synthetic",
          loader: syntheticImage(120, 80),
        }),
      );
    },
    expect: (p) => {
      expect(p.box(".i")).toMatchObject({ x: 0, y: 0, width: 200, height: 80 });
      expect(p.at(100, 40)).not.toBe(PAGE_BG);
    },
  },
  {
    id: "leaf-raw-konva",
    group: "Mixed leaves",
    title: "a raw Konva node still gets placed",
    note: "Nodes that are not smoove wrappers fall back to their numeric width and height.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(new Konva.Rect({ name: "r", width: 100, height: 50, fill: "#7ee787" }));
      root.add(new Block({ name: "after", width: 100, height: 40, background: "#4ea1ff" }));
    },
    expect: (p) => {
      expect(p.box(".r")).toMatchObject({ x: 0, y: 0, width: 100, height: 50 });
      expect(p.box(".after").x).toBe(100);
    },
  },
  {
    id: "leaf-invisible-skipped",
    group: "Mixed leaves",
    title: "an invisible child takes no space",
    note: "visible(false) behaves like display: none, so the row closes up instead of leaving a hole.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(new Block({ name: "a", width: 100, height: 60, background: "#4ea1ff" }));
      const hidden = new Block({ name: "b", width: 100, height: 60, background: "#7ee787" });
      hidden.visible(false);
      root.add(hidden);
      root.add(new Block({ name: "c", width: 100, height: 60, background: "#ff6b4e" }));
    },
    expect: (p) => {
      expect(p.box(".a").x).toBe(0);
      expect(p.box(".c").x).toBe(100);
      // Nothing paints where the hidden tile would have been.
      p.expectColor(150, 30, "#ff6b4e");
    },
  },
  {
    id: "leaf-radius-under-grow",
    group: "Mixed leaves",
    title: "flexGrow on a radius-based shape",
    note: "Growing a Circle writes width and height onto geometry Konva derives from radius — give radius shapes an explicit size instead.",
    divergence:
      "Radius and points shapes derive their geometry from Konva attrs that layout overwrites. The wrapper documents this; the case pins the behaviour so it cannot change silently.",
    build: (root) => {
      root.setAttrs({ flexDirection: "row", alignItems: "flex-start" });
      root.add(new Circle({ name: "c", radius: 40, flexGrow: 1, fill: "#4ea1ff" }));
    },
    expect: (p) => {
      const box = p.box(".c");
      expect(Number.isFinite(box.width)).toBe(true);
      expect(box.width).toBeGreaterThan(0);
    },
  },
];
