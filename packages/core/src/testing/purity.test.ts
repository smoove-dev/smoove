import Konva from "konva";
import { describe, expect, it } from "vitest";
import { random } from "../animation/random.js";
import { Composition } from "../engine/composition.js";
import { Sequence } from "../engine/sequence.js";
import { Block } from "../layout/block.js";
import { layoutChildWrites, seekTest, sweepContext } from "./purity.js";

let n = 0;
function makeComp(): { comp: Composition; seq: Sequence } {
  n += 1;
  const comp = new Composition({
    id: `purity-t${n}`,
    fps: 30,
    durationInFrames: 90,
    width: 640,
    height: 360,
  });
  const seq = new Sequence({ from: 0, durationInFrames: 90 });
  comp.add(seq);
  return { comp, seq };
}

describe("seekTest", () => {
  it("finds nothing in a pure composition", () => {
    const { comp, seq } = makeComp();
    const rect = new Konva.Rect({ name: "chip", width: 20, height: 20, fill: "#fff" });
    seq.add(rect);
    seq.register((f) => rect.x(f * 2));

    expect(seekTest(sweepContext(comp))).toEqual([]);
  });

  it("finds Math.random driving a position", () => {
    const { comp, seq } = makeComp();
    const rect = new Konva.Rect({ name: "chip", width: 20, height: 20, fill: "#fff" });
    seq.add(rect);
    seq.register(() => rect.x(Math.random() * 100));

    const hits = seekTest(sweepContext(comp));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.code).toBe("purity/seek-mismatch");
    expect(hits[0]?.node).toBe(rect);
    expect(hits[0]?.details).toMatchObject({ attr: "box" });
    expect(hits[0]?.details?.walked).not.toEqual(hits[0]?.details?.jumped);
  });

  it("finds a module-level generator advanced inside an updater", () => {
    const { comp, seq } = makeComp();
    const r = random("drift");
    const rect = new Konva.Rect({ name: "chip", width: 20, height: 20, fill: "#fff" });
    seq.add(rect);
    seq.register(() => rect.y(r.range(0, 100)));

    expect(seekTest(sweepContext(comp)).length).toBeGreaterThan(0);
  });

  it("finds a node only updated every tenth frame", () => {
    const { comp, seq } = makeComp();
    const rect = new Konva.Rect({ name: "chip", width: 20, height: 20, fill: "#fff" });
    seq.add(rect);
    seq.register((f) => {
      if (f % 10 === 0) rect.x(f);
    });

    expect(seekTest(sweepContext(comp)).length).toBeGreaterThan(0);
  });
});

describe("seekTest and sequences that ended", () => {
  it("ignores what a hidden node was left holding", () => {
    const { comp } = makeComp();
    // A sequence over the first 30 frames: its updater moves the chip each
    // frame, and whatever it wrote last stays on the node once it ends.
    const early = new Sequence({ from: 0, durationInFrames: 30 });
    const chip = new Konva.Rect({ name: "chip", width: 20, height: 20, fill: "#fff" });
    early.add(chip);
    early.register((f) => chip.x(f * 4));
    comp.add(early);

    expect(seekTest(sweepContext(comp))).toEqual([]);
  });

  it("ignores what a hidden node holds before its sequence starts", () => {
    const { comp } = makeComp();
    // Jumping backwards visits the late sequence first, so frames before it
    // starts find the chip where frame 60 left it; walking, it never moved.
    const late = new Sequence({ from: 60, durationInFrames: 30 });
    const chip = new Konva.Rect({ name: "chip", width: 20, height: 20, fill: "#fff" });
    late.add(chip);
    late.register((f) => chip.x(f * 4 + 10));
    comp.add(late);

    expect(seekTest(sweepContext(comp))).toEqual([]);
  });
});

describe("layoutChildWrites", () => {
  function withBlockChild(write: (child: Konva.Rect, frame: number) => void) {
    const { comp, seq } = makeComp();
    const card = new Block({ width: 300, height: 100, flexDirection: "row", gap: 10 });
    const child = new Konva.Rect({ name: "chip", width: 40, height: 40, fill: "#fff" });
    card.add(child);
    seq.add(card);
    seq.register((f) => write(child, f));
    return { comp, child };
  }

  it("finds an updater animating x on a Block child", () => {
    const { comp, child } = withBlockChild((c, f) => c.x(f * 3 + 1));
    const ctx = sweepContext(comp);
    const hits = layoutChildWrites(ctx);
    expect(hits.length).toBeGreaterThanOrEqual(ctx.samples.length - 1);
    expect(hits.every((h) => h.node === child && h.code === "purity/layout-child-position")).toBe(
      true,
    );
  });

  it("finds nothing when the updater animates scale", () => {
    const { comp } = withBlockChild((c, f) => c.scaleX(1 + f / 100));
    expect(layoutChildWrites(sweepContext(comp))).toEqual([]);
  });

  it("finds nothing when the moved node isn't laid out", () => {
    const { comp, seq } = makeComp();
    const rect = new Konva.Rect({ width: 20, height: 20 });
    seq.add(rect);
    seq.register((f) => rect.x(f));
    expect(layoutChildWrites(sweepContext(comp))).toEqual([]);
  });
});
