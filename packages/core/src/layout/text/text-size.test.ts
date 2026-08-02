import { describe, expect, it } from "vitest";
import { Composition } from "../../engine/composition.js";
import { Sequence } from "../../engine/sequence.js";
import { Text } from "./text.js";

let n = 0;
function makeComp(): Composition {
  n += 1;
  return new Composition({
    id: `text-size-t${n}`,
    fps: 30,
    durationInFrames: 100,
    width: 400,
    height: 200,
  });
}

describe("Text font size", () => {
  it("reads back the size it renders at", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const text = new Text({ text: "Hello", fontSize: 48 });
    seq.add(text);
    comp.add(seq);

    expect(text.fontSize()).toBe(48);
  });

  it("resizes in place and re-lays-out", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const text = new Text({ text: "Hello", fontSize: 48 });
    seq.add(text);
    comp.add(seq);
    const wide = text.width();

    text.setFontSize(24);

    expect(text.fontSize()).toBe(24);
    expect(text.width()).toBeLessThan(wide);
  });

  it("reports the fitted size, not the requested one, when fitText is set", () => {
    const comp = makeComp();
    const seq = new Sequence({ from: 0, durationInFrames: 100 });
    const text = new Text({
      text: "A very long line of text that cannot fit at the requested size",
      width: 100,
      fontSize: 200,
      fitText: { min: 8, max: 200 },
    });
    seq.add(text);
    comp.add(seq);

    expect(text.fontSize()).toBeLessThan(200);
    expect(text.fontSize()).toBeGreaterThanOrEqual(8);
  });
});
