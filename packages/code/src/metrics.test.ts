import { describe, expect, it } from "vitest";
import { type MeasureContext, measureString } from "./metrics.js";

// Fake monospace context: every glyph is `cell` wide.
function monoContext(cell: number): MeasureContext {
  return { measureText: (text) => ({ width: text.length * cell }) };
}

describe("measureString", () => {
  const ctx = monoContext(10);

  it("measures a single line", () => {
    expect(measureString(ctx, 10, "const")).toEqual({
      content: "const",
      newRows: 0,
      endColumn: 5,
      firstWidth: 5,
      maxWidth: 5,
      lastWidth: 5,
    });
  });

  it("measures multiple lines and tracks the widest", () => {
    const m = measureString(ctx, 10, "ab\ncde\nf");
    expect(m.newRows).toBe(2);
    expect(m.endColumn).toBe(1);
    expect(m.firstWidth).toBe(2);
    expect(m.maxWidth).toBe(3);
    expect(m.lastWidth).toBe(1);
  });

  it("measures the empty string as a single empty row", () => {
    expect(measureString(ctx, 10, "")).toMatchObject({
      newRows: 0,
      endColumn: 0,
      maxWidth: 0,
    });
  });
});
