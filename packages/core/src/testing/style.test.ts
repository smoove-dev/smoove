import Konva from "konva";
import { describe, expect, it } from "vitest";
import { interpolateColors } from "../animation/interpolate-colors.js";
import { Composition } from "../engine/composition.js";
import type { FontFaceDescriptor } from "../engine/runtime-defaults.js";
import { Sequence } from "../engine/sequence.js";
import { Font } from "../layout/text/font.js";
import { Text } from "../layout/text/text.js";
import type { CheckBeat } from "./findings.js";
import { sweepContext } from "./purity.js";
import { styleSweep } from "./style.js";

/** A font that never loads, so its Text draws in a fallback face. */
class StuckFont extends Font {
  protected override loadFace(_face: FontFaceDescriptor): Promise<void> {
    return new Promise(() => {});
  }
}

let n = 0;
// One beat: an entrance over frames 0 to 9, then held from 10 to 29.
const BEATS: CheckBeat[] = [{ name: "only", start: 0, settled: 10, end: 30, sheet: 29 }];
function makeComp(): { comp: Composition; seq: Sequence } {
  n += 1;
  const comp = new Composition({
    id: `style-t${n}`,
    fps: 30,
    durationInFrames: 30,
    width: 320,
    height: 180,
  });
  const seq = new Sequence({ from: 0, durationInFrames: 30 });
  comp.add(seq);
  return { comp, seq };
}
const run = (comp: Composition, style: Parameters<typeof styleSweep>[1]) =>
  styleSweep(sweepContext(comp, BEATS), style);
const codes = (r: ReturnType<typeof styleSweep>) => r.hits.map((h) => h.code);

const PALETTE = { bg: "#0c0b16", accent: "#ffd23f", white: "#ffffff" };

describe("styleSweep colors", () => {
  it("matches palette colors after parsing, with alpha and transparent stops", () => {
    const { comp, seq } = makeComp();
    seq.add(new Konva.Rect({ width: 10, height: 10, fill: "#FFD23F" }));
    seq.add(new Konva.Rect({ width: 10, height: 10, fill: "rgba(255, 210, 63, 0.4)" }));
    seq.add(new Konva.Rect({ width: 10, height: 10, stroke: "white" }));
    seq.add(
      new Konva.Rect({
        width: 10,
        height: 10,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: 10, y: 0 },
        fillLinearGradientColorStops: [0, "#ffd23f", 1, "transparent"],
      }),
    );
    expect(codes(run(comp, { palette: PALETTE }))).toEqual([]);
  });

  it("flags a nudged hex", () => {
    const { comp, seq } = makeComp();
    const chip = new Konva.Rect({ name: "chip", width: 10, height: 10, fill: "#ffd240" });
    seq.add(chip);
    const r = run(comp, { palette: PALETTE });
    expect(codes(r)).toContain("style/color");
    expect(r.hits[0]?.node).toBe(chip);
    expect(r.hits[0]?.details).toMatchObject({ color: "#ffd240" });
  });

  it("attributes a Text's fill to the Text, not its parts", () => {
    const { comp, seq } = makeComp();
    const title = new Text({ name: "title", text: "Hi", fill: "#123456" });
    seq.add(title);
    const r = run(comp, { palette: PALETTE });
    expect(r.hits.map((h) => h.node)).toContain(title);
  });

  it("lets a tween between palette colors pass through its in-between shades", () => {
    const { comp, seq } = makeComp();
    const chip = new Konva.Rect({ width: 10, height: 10, fill: "#0c0b16" });
    seq.add(chip);
    seq.register((f) => chip.fill(interpolateColors(f, [0, 10], ["#0c0b16", "#ffd23f"])));
    expect(codes(run(comp, { palette: PALETTE }))).toEqual([]);
  });
});

describe("styleSweep fonts", () => {
  const display = new StuckFont({
    family: "StyleDisplay",
    faces: [{ weight: 800, src: "/a.woff2" }],
  });

  it("flags a weight that wasn't declared", () => {
    const { comp, seq } = makeComp();
    seq.add(new Text({ text: "Hi", fontFamily: "StyleDisplay", fontStyle: "normal" }));
    expect(codes(run(comp, { fonts: [display] }))).toContain("style/font");
  });

  it("lets a family declared as a string cover every weight", () => {
    const { comp, seq } = makeComp();
    seq.add(new Text({ text: "Hi", fontFamily: "Plain", fontStyle: "bold" }));
    expect(codes(run(comp, { fonts: ["Plain"] }))).not.toContain("style/font");
  });

  it("flags a fallback face whether or not anything is declared", () => {
    const { comp, seq } = makeComp();
    seq.add(new Text({ name: "t", text: "Hi", font: display.face("800") }));
    expect(codes(run(comp, null))).toContain("style/fallback-font");
    expect(new Set(codes(run(comp, { fonts: [display] })))).toEqual(
      new Set(["style/fallback-font"]),
    );
  });
});

describe("styleSweep with nothing declared", () => {
  it("finds near-duplicate colors and lists colors most used first", () => {
    const { comp, seq } = makeComp();
    seq.add(new Konva.Rect({ width: 10, height: 10, fill: "#ffd23f" }));
    seq.add(new Konva.Rect({ width: 10, height: 10, fill: "#ffd23f" }));
    seq.add(new Konva.Rect({ width: 10, height: 10, fill: "#ffd240" }));
    const r = run(comp, null);
    expect(codes(r)).toContain("style/near-duplicate");
    expect(r.colorsInUse[0]).toBe("#ffd23f");
    expect(r.colorsInUse).toContain("#ffd240");
  });

  it("flags more than two font families", () => {
    const { comp, seq } = makeComp();
    for (const family of ["A", "B", "C"]) seq.add(new Text({ text: family, fontFamily: family }));
    expect(codes(run(comp, null))).toContain("style/font-families");
  });
});
