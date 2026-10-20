import { describe, expect, it } from "vitest";
import { Composition } from "../../engine/composition.js";
import type { FontFaceDescriptor } from "../../engine/runtime-defaults.js";
import { Sequence } from "../../engine/sequence.js";
import { Font } from "./font.js";
import { Text } from "./text.js";

let n = 0;
function makeComp(): { comp: Composition; seq: Sequence } {
  n += 1;
  const comp = new Composition({
    id: `text-probe-t${n}`,
    fps: 30,
    durationInFrames: 100,
    width: 400,
    height: 200,
  });
  const seq = new Sequence({ from: 0, durationInFrames: 100 });
  comp.add(seq);
  return { comp, seq };
}

/** A font that never finishes loading, like a face whose file is missing. */
class StuckFont extends Font {
  protected override loadFace(_face: FontFaceDescriptor): Promise<void> {
    return new Promise(() => {});
  }
}

const LONG = "The quick brown fox jumps over the lazy dog, again and again";

describe("Text _kmProbeText", () => {
  it("reports an ellipsis cut and keeps the full text", () => {
    const { seq } = makeComp();
    const text = new Text({ text: LONG, fontSize: 24, width: 100, wrap: "none" });
    seq.add(text);

    const p = text._kmProbeText();
    expect(p.full).toBe(LONG);
    expect(p.cut).toBe(true);
    expect(p.ellipsis).toBe(true);
    expect(p.shown.endsWith("…")).toBe(true);
  });

  it("reports a silent trim when the ellipsis is off", () => {
    const { seq } = makeComp();
    const text = new Text({ text: LONG, fontSize: 24, width: 100, wrap: "none", ellipsis: false });
    seq.add(text);

    const p = text._kmProbeText();
    expect(p.cut).toBe(true);
    expect(p.ellipsis).toBe(false);
  });

  it("reports no cut for text that fits", () => {
    const { seq } = makeComp();
    const text = new Text({ text: "Hi", fontSize: 24, fill: "#abcdef" });
    seq.add(text);

    const p = text._kmProbeText();
    expect(p.fill).toBe("#abcdef");
    expect(p.gradient).toBeNull();
    expect(p.cut).toBe(false);
    expect(p.shown).toBe("Hi");
    expect(p.fontSize).toBe(24);
  });

  it("never reports a typewriter mid-reveal as cut", () => {
    const { comp, seq } = makeComp();
    const text = new Text({
      text: "Typing along",
      fontSize: 24,
      typewriter: { durationInFrames: 40 },
    });
    seq.add(text);
    comp.setFrame(20);

    const p = text._kmProbeText();
    expect(p.cut).toBe(false);
    expect(p.shown).toBe(p.full);
  });

  it("reports the face it was given", () => {
    const { seq } = makeComp();
    const font = new StuckFont({
      family: "ProbeFace",
      faces: [{ weight: 800, src: "/nope.woff2" }],
    });
    const text = new Text({ text: "Face", font: font.face("800") });
    seq.add(text);

    const p = text._kmProbeText();
    expect(p.font.family).toBe("ProbeFace");
    expect(p.font.weight).toBe("800");
    expect(p.font.loaded).toBe(false);
  });
});
