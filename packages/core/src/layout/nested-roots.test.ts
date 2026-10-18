import { describe, expect, it, vi } from "vitest";
import { Block, Clip, Composition, Flex, Group, measure, Rect, Sequence } from "../index.js";

let n = 0;
function makeComp(): { comp: Composition; seq: Sequence } {
  n += 1;
  const comp = new Composition({
    id: `nested-roots-${n}`,
    fps: 30,
    durationInFrames: 30,
    width: 400,
    height: 400,
  });
  const seq = new Sequence();
  comp.add(seq);
  return { comp, seq };
}

/** A row whose first child grows 10px a frame, so the second child's x tracks the frame. */
function growingRow() {
  const row = new Block({ x: 0, y: 0, width: 400, flexDirection: "row", gap: 10 });
  const a = new Rect({ width: 50, height: 50 });
  const b = new Rect({ width: 50, height: 50 });
  row.add(a, b);
  const grow = (f: number) => a.width(50 + f * 10);
  return { row, b, grow };
}

describe("layout roots behind a plain Group", () => {
  it("reflow on every frame inside a Sequence", () => {
    const { comp, seq } = makeComp();
    const { row, b, grow } = growingRow();
    const body = new Group({ x: 20 });
    seq.add(body);
    body.add(row);
    seq.register(grow);

    comp.setFrame(5);
    expect(b.attrs.x).toBe(110);
    comp.setFrame(2);
    expect(b.attrs.x).toBe(80);
  });

  it("reflow on every frame inside a Clip", () => {
    const { comp, seq } = makeComp();
    const clip = new Clip({ from: 0, durationInFrames: 30 });
    seq.add(clip);
    const { row, b, grow } = growingRow();
    const body = new Group({ x: 20 });
    clip.add(body);
    body.add(row);
    clip.register(grow);

    comp.setFrame(5);
    expect(b.attrs.x).toBe(110);
    comp.setFrame(2);
    expect(b.attrs.x).toBe(80);
  });

  it("reflow when added after the clip was attached and active", () => {
    const { comp, seq } = makeComp();
    const clip = new Clip({ from: 0, durationInFrames: 30 });
    seq.add(clip);
    comp.setFrame(1);

    const { row, b, grow } = growingRow();
    const body = new Group();
    clip.add(body);
    body.add(row);
    clip.register(grow);

    comp.setFrame(4);
    expect(b.attrs.x).toBe(100);
  });

  it("are laid out once per frame, by the timeline that owns them", () => {
    const { comp, seq } = makeComp();
    const clip = new Clip({ from: 0, durationInFrames: 30 });
    seq.add(clip);
    const { row } = growingRow();
    const body = new Group();
    clip.add(body);
    body.add(row);
    const spy = vi.spyOn(row, "_kmComputeLayout");

    comp.setFrame(3);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("inside another layout's Group child are laid out too", () => {
    const { comp, seq } = makeComp();
    const outer = new Flex({ x: 0, y: 0, width: 400, height: 400, flexDirection: "column" });
    seq.add(outer);
    const holder = new Group({ width: 400, height: 100 });
    outer.add(holder);
    const { row, b, grow } = growingRow();
    holder.add(row);
    seq.register(grow);

    comp.setFrame(5);
    expect(b.attrs.x).toBe(110);
  });

  it("lets a plain Group sit in a layout, placed at its slot", () => {
    const { comp, seq } = makeComp();
    const outer = new Flex({
      x: 0,
      y: 0,
      width: 400,
      height: 400,
      flexDirection: "column",
      gap: 20,
    });
    seq.add(outer);
    outer.add(new Rect({ width: 50, height: 40 }));
    const holder = new Group({ width: 400, height: 100 });
    outer.add(holder);

    comp.setFrame(1);
    expect(holder.attrs.y).toBe(60);
  });

  it("are what measure() lays out for a node inside them", () => {
    const { seq } = makeComp();
    const outer = new Flex({ x: 0, y: 0, width: 400, height: 400, flexDirection: "column" });
    seq.add(outer);
    const holder = new Group({ x: 30, width: 400, height: 100 });
    outer.add(holder);
    const { row, b } = growingRow();
    holder.add(row);

    // a is 50 wide, the gap is 10: b sits at 60 inside the row, 90 on stage.
    expect(measure(b).x).toBe(90);
  });

  it("leave nested containers to their own root", () => {
    const { comp, seq } = makeComp();
    const outer = new Flex({ x: 0, y: 0, width: 400, height: 400, flexDirection: "column" });
    const inner = new Block({ width: 400, flexDirection: "row" });
    outer.add(inner);
    seq.add(outer);
    const spy = vi.spyOn(inner, "_kmComputeLayout");

    comp.setFrame(1);
    expect(spy).not.toHaveBeenCalled();
  });
});
