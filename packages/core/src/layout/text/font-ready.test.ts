import Konva from "konva";
import { FontLibrary } from "skia-canvas";
import { describe, expect, it } from "vitest";
import { Composition } from "../../engine/composition.js";
import type { FontFaceDescriptor } from "../../engine/runtime-defaults.js";
import { Sequence } from "../../engine/sequence.js";
import { Flex } from "../flex/flex.js";
import { Font } from "./font.js";
import { Text } from "./text.js";

const LORA = new URL("../../test/fixtures/lora-400-normal.woff2", import.meta.url).pathname;
const LABEL = "radius 6  stroke 2  snappy";

/**
 * A Font whose load the test releases by hand. Until then the family is
 * unknown to skia, so Text measures against the fallback face, exactly like a
 * browser that hasn't fetched the woff2 yet.
 */
class DeferredFont extends Font {
  private _release: () => void = () => {};
  private readonly _gate = new Promise<void>((resolve) => {
    this._release = resolve;
  });

  protected override loadFace(face: FontFaceDescriptor): Promise<void> {
    return this._gate.then(() => {
      FontLibrary.use(this.family, [face.src]);
    });
  }

  release(): Promise<void> {
    this._release();
    return this.whenReady();
  }
}

let n = 0;
function setup(family: string) {
  n += 1;
  const comp = new Composition({
    id: `font-ready-t${n}`,
    fps: 30,
    durationInFrames: 100,
    width: 1080,
    height: 400,
  });
  const seq = new Sequence({ from: 0, durationInFrames: 100 });
  const font = new DeferredFont({ family, faces: [{ weight: 400, src: LORA }] });
  seq.add(font);
  return { comp, seq, font };
}

/** Let the Text's own `whenReady().then` run after the load settles. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("Text re-measures when its Font face loads", () => {
  it("an unsized Text grows to the loaded face's width", async () => {
    const { comp, seq, font } = setup("FontReadyLoraA");
    // Mirrors the looks-sheet chip: an unsized, unwrapped label in a plain Group.
    const pill = new Konva.Group();
    const label = new Text({ text: LABEL, font: font.face("400"), fontSize: 26, wrap: "none" });
    pill.add(label);
    seq.add(pill);
    comp.add(seq);
    const before = label.width();

    await font.release();
    await settle();

    // The same Text built once the face is in is the width it should hug.
    const reference = new Text({ text: LABEL, font: font.face("400"), fontSize: 26, wrap: "none" });
    expect(reference.width()).not.toBeCloseTo(before, 0);
    expect(label.width()).toBeCloseTo(reference.width(), 3);
  });

  it("a Text with a declared width keeps it", async () => {
    const { comp, seq, font } = setup("FontReadyLoraB");
    const label = new Text({
      text: LABEL,
      font: font.face("400"),
      fontSize: 26,
      wrap: "none",
      width: 504,
    });
    seq.add(label);
    comp.add(seq);

    await font.release();
    await settle();

    expect(label.width()).toBe(504);
  });

  it("a hug Text in a Flex row grows the row", async () => {
    const { comp, seq, font } = setup("FontReadyLoraC");
    const row = new Flex({ flexDirection: "row" });
    const label = new Text({ text: LABEL, font: font.face("400"), fontSize: 26, wrap: "none" });
    row.add(label);
    seq.add(row);
    comp.add(seq);

    await font.release();
    await settle();
    comp.setFrame(1);

    const reference = new Text({ text: LABEL, font: font.face("400"), fontSize: 26, wrap: "none" });
    // Flex snaps its boxes to whole pixels.
    expect(label.width()).toBeCloseTo(reference.width(), 0);
    expect(row.width()).toBeCloseTo(reference.width(), 0);
  });

  it("a Text stretched by a Flex column keeps the column's width", async () => {
    const { comp, seq, font } = setup("FontReadyLoraD");
    const column = new Flex({ flexDirection: "column", width: 600 });
    const label = new Text({ text: LABEL, font: font.face("400"), fontSize: 26 });
    column.add(label);
    seq.add(column);
    comp.add(seq);

    await font.release();
    await settle();

    expect(label.width()).toBe(600);
  });
});
