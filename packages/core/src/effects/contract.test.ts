import { describe, expect, it } from "vitest";
import { isSmooveEffect, maxPadding, normalizePadding } from "./contract.js";

describe("normalizePadding", () => {
  it("expands a scalar to four sides", () => {
    expect(normalizePadding(8)).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });

  it("passes a per-side object through", () => {
    const p = { top: 170, right: 8, bottom: 8, left: 8 };
    expect(normalizePadding(p)).toEqual(p);
  });

  it("treats undefined as zero", () => {
    expect(normalizePadding(undefined)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("expands zero without becoming undefined", () => {
    expect(normalizePadding(0)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe("maxPadding", () => {
  it("takes the per-side maximum across a chain", () => {
    expect(
      maxPadding([
        { top: 170, right: 8, bottom: 8, left: 8 },
        { top: 4, right: 40, bottom: 0, left: 0 },
      ]),
    ).toEqual({ top: 170, right: 40, bottom: 8, left: 8 });
  });

  it("is zero for an empty chain", () => {
    expect(maxPadding([])).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("passes a single box through", () => {
    const p = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(maxPadding([p])).toEqual(p);
  });
});

describe("isSmooveEffect", () => {
  it("accepts an object carrying the brand", () => {
    expect(isSmooveEffect({ _fxEffect: true })).toBe(true);
  });

  it("rejects plain objects, null, arrays and primitives", () => {
    expect(isSmooveEffect({})).toBe(false);
    expect(isSmooveEffect(null)).toBe(false);
    expect(isSmooveEffect(undefined)).toBe(false);
    expect(isSmooveEffect(7)).toBe(false);
    expect(isSmooveEffect("effect")).toBe(false);
    expect(isSmooveEffect([])).toBe(false);
  });
});
