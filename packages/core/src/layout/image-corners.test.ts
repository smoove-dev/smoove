import { describe, expect, it } from "vitest";
import { clampCorners } from "./corners.js";

describe("clampCorners", () => {
  it("leaves radii that already fit alone", () => {
    expect(clampCorners([10, 10, 10, 10], 100, 100)).toEqual([10, 10, 10, 10]);
  });

  it("turns an oversized uniform radius into a disc on a square", () => {
    expect(clampCorners([9999, 9999, 9999, 9999], 100, 100)).toEqual([50, 50, 50, 50]);
  });

  it("clamps against the shortest edge on a non-square box", () => {
    expect(clampCorners([9999, 9999, 9999, 9999], 200, 100)).toEqual([50, 50, 50, 50]);
  });

  it("scales every radius by one common factor, not just the offender", () => {
    // Top edge needs 100/(80+40) = 0.8333…, and that factor applies to all four.
    const [tl, tr, br, bl] = clampCorners([80, 40, 0, 0], 100, 1000);
    expect(tl).toBeCloseTo(66.667, 3);
    expect(tr).toBeCloseTo(33.333, 3);
    expect(br).toBe(0);
    expect(bl).toBe(0);
  });

  it("handles a zero-size box without dividing by zero", () => {
    expect(clampCorners([10, 10, 10, 10], 0, 0)).toEqual([0, 0, 0, 0]);
  });
});
