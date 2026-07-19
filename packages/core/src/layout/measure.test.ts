import { describe, expect, it } from "vitest";
import { Composition, Flex, measure, Rect, Sequence, Text } from "../index.js";

let n = 0;
function makeComp(): Composition {
  n += 1;
  return new Composition({
    id: `measure-t${n}`,
    fps: 30,
    durationInFrames: 300,
    width: 1280,
    height: 720,
  });
}

describe("measure — box path", () => {
  it("measures a flex tile in a never-activated sequence (the hero-mask case)", () => {
    const comp = makeComp();
    const later = new Sequence({ from: 100, durationInFrames: 50 });
    const flex = new Flex({ x: 100, y: 200, flexDirection: "row", gap: 10 });
    const a = new Rect({ width: 50, height: 40, fill: "#f00" });
    const b = new Rect({ width: 30, height: 40, fill: "#00f" });
    flex.add(a);
    flex.add(b);
    later.add(flex);
    comp.add(later);
    comp.setFrame(0); // seek straight past — `later` never activates

    const m = measure(b);
    expect(m).toMatchObject({ x: 160, y: 200, width: 30, height: 40 }); // 100+50+10

    // Equivalence: activating for real yields the same geometry.
    comp.setFrame(120);
    expect(b.getAbsolutePosition()).toMatchObject({ x: 160, y: 200 });
  });

  it("includes ancestor transforms (stage space)", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 100, durationInFrames: 50 });
    const flex = new Flex({ x: 30, y: 40, flexDirection: "row" });
    const r = new Rect({ width: 20, height: 20, fill: "#0f0" });
    flex.add(r);
    seq.add(flex);
    comp.add(seq);
    comp.setFrame(0);
    flex.scale({ x: 2, y: 2 });
    const m = measure(r);
    expect(m).toMatchObject({ x: 30, y: 40, width: 40, height: 40 });
  });

  it("drives updaters to the requested frame with { at }", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 100, durationInFrames: 50 });
    const box = new Rect({ x: 0, y: 0, width: 10, height: 10, fill: "#f00" });
    seq.add(box);
    seq.register((local) => {
      box.width(10 + local * 2);
    });
    comp.add(seq);
    comp.setFrame(0);
    expect(measure(box, { at: 20 }).width).toBe(50);
    // Inactive sequence: measured state persists (per spec's mutation decision).
    expect(box.width()).toBe(50);
  });

  it("restores an active sequence to its live frame after { at }", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const box = new Rect({ x: 0, y: 0, width: 10, height: 10, fill: "#f00" });
    seq.add(box);
    seq.register((local) => {
      box.width(10 + local);
    });
    comp.add(seq);
    comp.setFrame(5); // active, live local 5 → width 15
    const m = measure(box, { at: 50 });
    expect(m.width).toBe(60);
    expect(box.width()).toBe(15); // restored exactly
  });

  it("reflects a typewriter reveal height with { at } (reserveHeight: false)", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 50, durationInFrames: 200 });
    const col = new Flex({ flexDirection: "column", width: 200 });
    const t = new Text({
      text: "one two three four five six seven eight nine ten eleven twelve",
      fontSize: 24,
      typewriter: { step: 1, reserveHeight: false },
    });
    col.add(t);
    seq.add(col);
    comp.add(seq);
    comp.setFrame(0);
    const early = measure(t, { at: 1 }).height;
    const late = measure(t, { at: 199 }).height;
    expect(late).toBeGreaterThan(early);
  });

  it("throws on { at } outside a Sequence", () => {
    const lone = new Rect({ width: 10, height: 10 });
    expect(() => measure(lone, { at: 3 })).toThrow(/Sequence/);
  });

  it("throws on a non-integer { at }", () => {
    const comp = makeComp();
    const seq = new Sequence();
    const box = new Rect({ width: 10, height: 10 });
    seq.add(box);
    comp.add(seq);
    expect(() => measure(box, { at: 1.5 })).toThrow(/integer/);
    expect(() => measure(box, { at: -1 })).toThrow(/integer/);
  });

  it("throws when { at } re-enters from a measure-driven updater", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 100, durationInFrames: 50 });
    const box = new Rect({ x: 0, y: 0, width: 10, height: 10, fill: "#f00" });
    seq.add(box);
    seq.register(() => {
      measure(box, { at: 0 });
    });
    comp.add(seq);
    comp.setFrame(0);
    expect(() => measure(box, { at: 1 })).toThrow(/re-enter/);
  });

  it("measures a bare node without { at } even when detached", () => {
    const lone = new Rect({ x: 7, y: 8, width: 10, height: 12 });
    expect(measure(lone)).toMatchObject({ x: 7, y: 8, width: 10, height: 12 });
  });

  it("exposes .measure() sugar on the wrappers", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 100, durationInFrames: 50 });
    const flex = new Flex({ x: 10, y: 10, flexDirection: "row" });
    const r = new Rect({ width: 20, height: 20, fill: "#0f0" });
    flex.add(r);
    seq.add(flex);
    comp.add(seq);
    comp.setFrame(0);
    expect(flex.measure()).toMatchObject({ x: 10, y: 10 });
    expect(r.measure().width).toBe(20);
    const t = new Text({ text: "hi", fontSize: 20 });
    seq.add(t);
    expect(t.measure().lines?.length).toBe(1);
  });
});
