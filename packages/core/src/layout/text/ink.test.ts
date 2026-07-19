import { describe, expect, it } from "vitest";
import { Composition, measure, Sequence, Text } from "../../index.js";

let n = 0;
function makeComp(): Composition {
  n += 1;
  return new Composition({
    id: `ink-t${n}`,
    fps: 30,
    durationInFrames: 10,
    width: 800,
    height: 600,
  });
}

describe("measure — Text lines", () => {
  it("returns per-line rects, ink and baseline", () => {
    const comp = makeComp();
    const seq = new Sequence();
    const t = new Text({
      x: 40,
      y: 60,
      width: 180,
      text: "Hello wonderful world of markers and masks",
      fontSize: 24,
    });
    seq.add(t);
    comp.add(seq);
    comp.setFrame(0);

    const m = measure(t);
    const lines = m.lines ?? [];
    expect(lines.length).toBeGreaterThan(1);

    let prevBottom = Number.NEGATIVE_INFINITY;
    for (const line of lines) {
      // Stage space: inside the wrapper placed at (40, 60).
      expect(line.x).toBeGreaterThanOrEqual(40);
      expect(line.y).toBeGreaterThanOrEqual(60);
      expect(line.width).toBeGreaterThan(0);
      // Lines stack downward without overlap.
      expect(line.y).toBeGreaterThanOrEqual(prevBottom - 0.5);
      prevBottom = line.y + line.height;
      // Ink is glyph-tight: never wider than the line box (± antialias slack),
      // and the baseline sits inside the ink's vertical extent.
      expect(line.ink.width).toBeLessThanOrEqual(line.width + 2);
      expect(line.baseline).toBeGreaterThan(line.ink.y);
      expect(line.baseline).toBeLessThanOrEqual(line.ink.y + line.ink.height + 0.5);
      // Ranges cover displayed chars in order.
      expect(line.range.end).toBeGreaterThan(line.range.start);
    }
  });

  it("ink rect brackets the rendered glyph pixels (pixel-bracket)", () => {
    const comp = makeComp();
    const seq = new Sequence();
    const t = new Text({ x: 20, y: 20, text: "Hxg", fontSize: 48, fill: "#ffffff" });
    seq.add(t);
    comp.add(seq);
    comp.setFrame(0);
    seq.draw();

    const line = measure(t).lines?.[0];
    expect(line).toBeDefined();
    if (!line) return;

    type SkiaLayerCanvas = { _canvas: { getContext(k: "2d"): CanvasRenderingContext2D } };
    const ctx = (seq.getCanvas() as unknown as SkiaLayerCanvas)._canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, 800, 600);
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let y = 0; y < 600; y++) {
      for (let x = 0; x < 800; x++) {
        if ((img.data[(y * 800 + x) * 4 + 3] ?? 0) > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    expect(minX).toBeLessThan(Number.POSITIVE_INFINITY); // something rendered

    const slack = 2.5; // antialiasing + metric rounding
    expect(line.ink.x).toBeLessThanOrEqual(minX + slack);
    expect(line.ink.y).toBeLessThanOrEqual(minY + slack);
    expect(line.ink.x + line.ink.width).toBeGreaterThanOrEqual(maxX - slack);
    expect(line.ink.y + line.ink.height).toBeGreaterThanOrEqual(maxY - slack);
    // ...and is actually tight, not just an over-approximation:
    expect(line.ink.x).toBeGreaterThanOrEqual(minX - 6);
    expect(line.ink.y).toBeGreaterThanOrEqual(minY - 6);
    expect(line.ink.x + line.ink.width).toBeLessThanOrEqual(maxX + 6);
    expect(line.ink.y + line.ink.height).toBeLessThanOrEqual(maxY + 6);
  });
});
