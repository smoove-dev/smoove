import Konva from "konva";
import { describe, expect, it, vi } from "vitest";
import { Composition, type HighlightConfig, Sequence, Text } from "../../index.js";

let n = 0;
function makeComp(): { comp: Composition; seq: Sequence } {
  n += 1;
  const comp = new Composition({
    id: `text-hl-${n}`,
    fps: 30,
    durationInFrames: 60,
    width: 800,
    height: 200,
  });
  const seq = new Sequence();
  comp.add(seq);
  return { comp, seq };
}

/** The highlight marks a Text paints, read off its internal Konva rects. */
const marks = (text: Text): Konva.Rect[] =>
  text.find(
    (node: Konva.Node) => node instanceof Konva.Rect && node.fill() !== undefined,
  ) as Konva.Rect[];

describe("Text highlights stay live without a manual relayout", () => {
  it("repaints an in-place mutation made in an updater", () => {
    const { comp, seq } = makeComp();
    const hl: HighlightConfig = { start: 0, end: 5, background: "#ff0", progress: 0 };
    const text = new Text({ text: "hello world", fontSize: 40, highlights: [hl] });
    seq.add(text);
    seq.register((frame) => {
      hl.progress = frame / 10;
    });

    comp.setFrame(1);
    const partial = marks(text)[0]?.width() ?? 0;
    comp.setFrame(10);
    const full = marks(text)[0]?.width() ?? 0;
    expect(partial).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(partial * 2);
  });

  it("follows a moved range (a spoken-word box)", () => {
    const { comp, seq } = makeComp();
    const spoken: HighlightConfig = { start: 0, end: 5, background: "#ff0" };
    const text = new Text({ text: "hello world", fontSize: 40, highlights: [spoken] });
    seq.add(text);
    seq.register((frame) => {
      spoken.start = frame < 5 ? 0 : 6;
      spoken.end = frame < 5 ? 5 : 11;
    });

    comp.setFrame(1);
    const first = marks(text)[0]?.x() ?? 0;
    comp.setFrame(6);
    expect(marks(text)[0]?.x() ?? 0).toBeGreaterThan(first);
  });

  it("repaints when the whole array is replaced with setAttr", () => {
    const { comp, seq } = makeComp();
    const text = new Text({ text: "hello world", fontSize: 40 });
    seq.add(text);
    comp.setFrame(1);
    expect(marks(text)).toHaveLength(0);

    text.setAttr("highlights", [
      { start: 0, end: 5, background: "#ff0" },
      { start: 6, end: 11, background: "#0ff" },
    ]);
    expect(marks(text)).toHaveLength(2);
  });

  it("skips the repaint on frames where nothing changed", () => {
    const { comp, seq } = makeComp();
    const hl: HighlightConfig = { start: 0, end: 5, background: "#ff0" };
    const text = new Text({ text: "hello world", fontSize: 40, highlights: [hl] });
    seq.add(text);
    comp.setFrame(1);
    const repaint = vi.spyOn(text as unknown as { _layoutHighlights(): void }, "_layoutHighlights");

    comp.setFrame(2);
    comp.setFrame(3);
    expect(repaint).not.toHaveBeenCalled();
    hl.progress = 0.5;
    comp.setFrame(4);
    expect(repaint).toHaveBeenCalledTimes(1);
  });
});
