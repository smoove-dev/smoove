import { describe, expect, it } from "vitest";
import { findAllCodeRanges, isPointInCodeRange, lines, pointToPoint, word } from "./range.js";

const INF = Number.POSITIVE_INFINITY;

describe("range constructors", () => {
  it("lines() spans a single line to infinity when to is omitted", () => {
    expect(lines(2)).toEqual([
      [2, 0],
      [2, INF],
    ]);
  });

  it("lines(from, to) spans across lines", () => {
    expect(lines(1, 3)).toEqual([
      [1, 0],
      [3, INF],
    ]);
  });

  it("word() covers a fixed length", () => {
    expect(word(0, 6, 3)).toEqual([
      [0, 6],
      [0, 9],
    ]);
  });

  it("word() runs to end of line when length omitted", () => {
    expect(word(0, 6)).toEqual([
      [0, 6],
      [0, INF],
    ]);
  });

  it("pointToPoint() builds an arbitrary span", () => {
    expect(pointToPoint(0, 2, 1, 4)).toEqual([
      [0, 2],
      [1, 4],
    ]);
  });
});

describe("isPointInCodeRange", () => {
  const range = pointToPoint(1, 2, 3, 4);

  it("includes a point on the start line at/after the start column", () => {
    expect(isPointInCodeRange([1, 2], range)).toBe(true);
    expect(isPointInCodeRange([1, 1], range)).toBe(false);
  });

  it("includes interior lines fully", () => {
    expect(isPointInCodeRange([2, 99], range)).toBe(true);
  });

  it("excludes the end column (half-open on the end)", () => {
    expect(isPointInCodeRange([3, 3], range)).toBe(true);
    expect(isPointInCodeRange([3, 4], range)).toBe(false);
  });
});

describe("findAllCodeRanges", () => {
  it("finds an exact string match on one line", () => {
    const code = "const number = createSignal(7);";
    const start = code.indexOf("createSignal");
    expect(findAllCodeRanges(code, "createSignal")).toEqual([
      [
        [0, start],
        [0, start + "createSignal".length],
      ],
    ]);
  });

  it("finds matches across multiple lines", () => {
    const code = "a\nfoo\nb\nfoo";
    expect(findAllCodeRanges(code, "foo")).toEqual([
      [
        [1, 0],
        [1, 3],
      ],
      [
        [3, 0],
        [3, 3],
      ],
    ]);
  });

  it("respects the limit", () => {
    expect(findAllCodeRanges("x x x", "x", 2)).toHaveLength(2);
  });

  it("treats a plain string literally (no regex metachars)", () => {
    const code = "a.b a+b";
    expect(findAllCodeRanges(code, "a.b")).toEqual([
      [
        [0, 0],
        [0, 3],
      ],
    ]);
  });
});
