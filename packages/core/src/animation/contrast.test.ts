import { describe, expect, it } from "vitest";
import { contrastRatio, parseColor, relativeLuminance } from "./color.js";

describe("contrast helpers", () => {
  it("gives 21 for black on white and 1 for a color on itself", () => {
    expect(contrastRatio(parseColor("#000"), parseColor("#fff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseColor("#ffd23f"), parseColor("#ffd23f"))).toBe(1);
  });

  it("matches the spec's sample pair", () => {
    expect(contrastRatio(parseColor("#9a95b8"), parseColor("#ffd23f"))).toBeCloseTo(2.0, 1);
  });

  it("is symmetric and ignores alpha", () => {
    const a = parseColor("rgba(255, 210, 63, 0.4)");
    const b = parseColor("#0c0b16");
    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
    expect(relativeLuminance(a)).toBe(relativeLuminance(parseColor("#ffd23f")));
  });
});
