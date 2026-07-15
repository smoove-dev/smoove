import { describe, expect, it } from "vitest";
import { CodeCursor } from "./cursor.js";
import { fullSelection } from "./range.js";
import type { CodeScope } from "./scope.js";

// Fake monospace context: 10px per glyph.
const CELL = 10;
const context = { measureText: (t: string) => ({ width: t.length * CELL }) };

function newCursor() {
  const cursor = new CodeCursor();
  cursor.setup({
    context,
    monoWidth: CELL,
    lineHeight: 20,
    fontHeight: 16,
    verticalOffset: 12,
    fallbackFill: "#ffffff",
    highlighter: null,
    caches: null,
    selection: fullSelection(),
    oldSelection: null,
    selectionProgress: null,
  });
  return cursor;
}

function draw(scope: CodeScope) {
  const cursor = newCursor();
  cursor.drawScope(scope);
  return cursor.getDrawingInfo();
}

describe("CodeCursor static layout", () => {
  it("places glyphs left to right on one line with the fallback fill", () => {
    const info = draw({ progress: 0, fragments: ["ab"] });
    const text = info.map((i) => i.text).join("");
    expect(text).toBe("ab");
    expect(info[0].x).toBe(0);
    expect(info[0].y).toBe(0);
    expect(info.every((i) => i.fill === "#ffffff")).toBe(true);
    expect(info.every((i) => i.alpha === 1)).toBe(true);
  });

  it("advances y by lineHeight across a newline", () => {
    const info = draw({ progress: 0, fragments: ["a\nb"] });
    const a = info.find((i) => i.text === "a");
    const b = info.find((i) => i.text === "b");
    expect(a?.y).toBe(0);
    expect(b?.y).toBe(20);
    expect(b?.x).toBe(0);
  });

  it("selects everything by default (time = 1)", () => {
    const info = draw({ progress: 0, fragments: ["ab"] });
    expect(info.every((i) => i.time === 1)).toBe(true);
  });
});

describe("CodeCursor crossfade", () => {
  const changing: CodeScope = {
    progress: 0.5,
    fragments: [{ before: "x", after: "yy" }],
  };

  it("dims a changing fragment at the midpoint", () => {
    const info = draw(changing);
    expect(info.length).toBeGreaterThan(0);
    expect(info.every((i) => i.alpha < 1)).toBe(true);
  });

  it("shows the before side below the midpoint and the after side above", () => {
    const before = draw({
      progress: 0.25,
      fragments: [{ before: "x", after: "yy" }],
    });
    const after = draw({
      progress: 0.75,
      fragments: [{ before: "x", after: "yy" }],
    });
    expect(before.map((i) => i.text).join("")).toBe("x");
    expect(after.map((i) => i.text).join("")).toBe("yy");
  });
});

describe("CodeCursor size", () => {
  it("reports width and height in pixels", () => {
    const cursor = newCursor();
    cursor.measureSize({ progress: 0, fragments: ["abc\nde"] });
    const size = cursor.getSize();
    expect(size.x).toBe(3 * CELL); // widest line "abc"
    expect(size.y).toBeGreaterThan(20); // at least two lines
  });
});
