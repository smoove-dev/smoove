import Konva from "konva";
import { describe, expect, it } from "vitest";
import { Composition } from "../engine/composition.js";
import { Sequence } from "../engine/sequence.js";
import { Block } from "../layout/block.js";
import { countAt, probe, probeAt } from "./probe.js";

let n = 0;
function makeComp(): Composition {
  n += 1;
  return new Composition({
    id: `probe-t${n}`,
    fps: 30,
    durationInFrames: 300,
    width: 320,
    height: 240,
  });
}

describe("probe", () => {
  it("reports stage-space box, effective opacity and name", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const group = new Konva.Group({ x: 10, y: 20, opacity: 0.5 });
    const rect = new Konva.Rect({
      x: 5,
      y: 5,
      width: 40,
      height: 30,
      opacity: 0.5,
      name: "chip",
    });
    group.add(rect);
    seq.add(group);
    comp.add(seq);
    comp.setFrame(0);

    const [p] = probe(comp, ".chip");
    expect(p).toBeDefined();
    expect(p?.name).toBe("chip");
    expect(p?.box).toEqual({ x: 15, y: 25, width: 40, height: 30 });
    expect(p?.opacity).toBeCloseTo(0.25);
    expect(p?.visible).toBe(true);
  });

  it("marks a node inside an inactive sequence as not visible", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 50, durationInFrames: 10 });
    seq.add(new Konva.Rect({ width: 10, height: 10, name: "chip" }));
    comp.add(seq);
    comp.setFrame(0);

    const [p] = probe(comp, ".chip");
    expect(p?.visible).toBe(false);
  });

  it("marks a zero-opacity node as not visible", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    seq.add(new Konva.Rect({ width: 10, height: 10, opacity: 0, name: "chip" }));
    comp.add(seq);
    comp.setFrame(0);

    expect(probe(comp, ".chip")[0]?.visible).toBe(false);
  });

  it("reports a shape's flat fill as paint", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    seq.add(new Konva.Rect({ width: 10, height: 10, fill: "#FF2D3F", name: "chip" }));
    comp.add(seq);
    comp.setFrame(0);

    expect(probe(comp, ".chip")[0]?.paint).toEqual({ kind: "color", color: "#FF2D3F" });
  });
});

describe("probeAt", () => {
  it("drives the composition to a frame before probing", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const rect = new Konva.Rect({ width: 10, height: 10, name: "chip" });
    seq.add(rect);
    seq.register((frame) => rect.x(frame * 2));
    comp.add(seq);

    expect(probeAt(comp, 7, ".chip")[0]?.box.x).toBe(14);
  });

  it("accepts a time in seconds and rounds to the nearest frame", () => {
    const comp = makeComp(); // 30fps
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const rect = new Konva.Rect({ width: 10, height: 10, name: "chip" });
    seq.add(rect);
    seq.register((frame) => rect.x(frame));
    comp.add(seq);

    // 0.2s at 30fps is frame 6.
    expect(probeAt(comp, { time: 0.2 }, ".chip")[0]?.box.x).toBe(6);
  });

  it("counts only what is on screen", () => {
    const comp = makeComp();
    const early = new Sequence({ from: 0, durationInFrames: 5 });
    const late = new Sequence({ from: 0, durationInFrames: 300 });
    for (let i = 0; i < 3; i += 1) {
      early.add(new Konva.Rect({ width: 4, height: 4, name: "dot" }));
    }
    late.add(new Konva.Rect({ width: 4, height: 4, name: "dot" }));
    comp.add(early);
    comp.add(late);

    expect(countAt(comp, 0, ".dot")).toBe(4);
    expect(countAt(comp, { time: 6.0 }, ".dot")).toBe(1);
  });
});

describe("Block paint", () => {
  it("reports a flat background", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    seq.add(new Block({ width: 50, height: 50, background: "#FF2D3F", name: "card" }));
    comp.add(seq);

    expect(probeAt(comp, 0, ".card")[0]?.paint).toEqual({ kind: "color", color: "#FF2D3F" });
  });

  it("reports a gradient background as its resolved stops", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    seq.add(
      new Block({
        width: 50,
        height: 50,
        name: "card",
        background: {
          gradient: {
            type: "linear",
            angle: 90,
            stops: [
              [0, "#000"],
              [1, "#FFF"],
            ],
          },
        },
      }),
    );
    comp.add(seq);

    expect(probeAt(comp, 0, ".card")[0]?.paint).toEqual({
      kind: "gradient",
      stops: [0, "#000", 1, "#FFF"],
    });
  });

  it("reports no paint for a background-less block", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    seq.add(new Block({ width: 50, height: 50, name: "card" }));
    comp.add(seq);

    expect(probeAt(comp, 0, ".card")[0]?.paint).toBeUndefined();
  });
});

describe("probe targets", () => {
  it("accepts a composition with typed props", () => {
    // Typed props make Composition<P> invariant in P; probes must still take it.
    const comp = new Composition({
      id: "probe-typed-props",
      fps: 30,
      durationInFrames: 60,
      width: 320,
      height: 240,
      props: { slogan: "hi" },
    });
    const seq = new Sequence();
    comp.add(seq);
    seq.add(new Konva.Rect({ name: "r", width: 10, height: 10, fill: "#fff" }));

    expect(probeAt(comp, { time: 1 }, ".r")).toHaveLength(1);
    expect(countAt(comp, 2, ".r")).toBe(1);
  });
});
