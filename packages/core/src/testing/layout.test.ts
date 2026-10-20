import Konva from "konva";
import { describe, expect, it } from "vitest";
import { Composition } from "../engine/composition.js";
import { Sequence } from "../engine/sequence.js";
import { Block } from "../layout/block.js";
import { Image } from "../layout/image.js";
import { Rect } from "../layout/shapes.js";
import { Text } from "../layout/text/text.js";
import { isContentNode, layoutSweep } from "./layout.js";
import { sweepContext } from "./purity.js";

let n = 0;
function makeComp(width = 640, height = 360): { comp: Composition; seq: Sequence } {
  n += 1;
  const comp = new Composition({
    id: `layout-t${n}`,
    fps: 30,
    durationInFrames: 30,
    width,
    height,
  });
  const seq = new Sequence({ from: 0, durationInFrames: 30 });
  comp.add(seq);
  return { comp, seq };
}

const LONG = "The quick brown fox jumps over the lazy dog, again and again";
const codes = (comp: Composition) => new Set(layoutSweep(sweepContext(comp)).map((h) => h.code));

describe("layoutSweep", () => {
  it("finds text cut by an ellipsis", () => {
    const { comp, seq } = makeComp();
    seq.add(
      new Text({ name: "title", text: LONG, fontSize: 24, width: 120, wrap: "none", x: 20, y: 20 }),
    );
    const hits = layoutSweep(sweepContext(comp));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.code === "layout/text-ellipsis")).toBe(true);
    expect(hits[0]?.details).toMatchObject({ full: LONG });
  });

  it("calls a silent trim an overflow", () => {
    const { comp, seq } = makeComp();
    seq.add(
      new Text({
        text: LONG,
        fontSize: 24,
        width: 120,
        wrap: "none",
        ellipsis: false,
        x: 20,
        y: 20,
      }),
    );
    expect(codes(comp)).toEqual(new Set(["layout/text-overflow"]));
  });

  it("finds text running past its Block's content box", () => {
    const { comp, seq } = makeComp();
    const card = new Block({
      x: 20,
      y: 20,
      width: 200,
      height: 80,
      padding: 20,
      flexDirection: "column",
    });
    card.add(
      new Text({
        text: "Wider than the card can hold",
        fontSize: 24,
        wrap: "none",
        ellipsis: false,
        width: 400,
      }),
    );
    seq.add(card);
    expect(codes(comp)).toContain("layout/text-overflow");
  });

  it("finds text half off the canvas, and lets a rect bleed", () => {
    const { comp, seq } = makeComp();
    seq.add(new Text({ name: "edge", text: "Edge", fontSize: 48, x: 600, y: 20 }));
    seq.add(new Konva.Rect({ x: 600, y: 200, width: 200, height: 50, fill: "#333" }));
    const hits = layoutSweep(sweepContext(comp));
    expect(new Set(hits.map((h) => h.code))).toEqual(new Set(["layout/off-canvas"]));
    expect(hits.every((h) => h.node?.name() === "edge")).toBe(true);
  });

  it("finds content outside the vertical safe zone, on a vertical canvas only", () => {
    const tall = makeComp(1080, 1920);
    tall.seq.add(new Text({ text: "Low", fontSize: 48, x: 200, y: 1700 }));
    expect(codes(tall.comp)).toEqual(new Set(["layout/safe-zone"]));

    const wide = makeComp(1920, 1080);
    wide.seq.add(new Text({ text: "Low", fontSize: 48, x: 200, y: 900 }));
    expect(codes(wide.comp).size).toBe(0);
  });

  it("ignores an empty Text and a zero-width Image", () => {
    const { comp, seq } = makeComp();
    seq.add(new Text({ text: "", fontSize: 24, x: 630, y: 20 }));
    seq.add(new Image({ x: 700, y: 20, width: 0, height: 40 }));
    expect(layoutSweep(sweepContext(comp))).toEqual([]);
  });
});

describe("isContentNode", () => {
  class Caption extends Text {}
  it("knows content from decoration", () => {
    expect(isContentNode(new Text({ text: "a" }))).toBe(true);
    expect(isContentNode(new Caption({ text: "a" }))).toBe(true);
    expect(isContentNode(new Image({ width: 10, height: 10 }))).toBe(true);
    expect(isContentNode(new Rect({ width: 10, height: 10 }))).toBe(false);
    expect(isContentNode(new Block({}))).toBe(false);
  });
});
