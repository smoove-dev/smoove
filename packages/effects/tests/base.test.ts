import { describe, expect, it } from "vitest";
import { parseColorVec4, parseHexColor } from "../src/color.js";

describe("color parsing", () => {
  it("parses #rrggbb", () => {
    expect(parseHexColor("#00b140")).toEqual({ r: 0, g: 177, b: 64, a: 255 });
  });
  it("parses #rgb shorthand", () => {
    expect(parseHexColor("#f0a")).toEqual({ r: 255, g: 0, b: 170, a: 255 });
  });
  it("parses #rrggbbaa into vec4", () => {
    expect(parseColorVec4("#00000000")).toEqual([0, 0, 0, 0]);
  });
  it("throws on garbage", () => {
    expect(() => parseHexColor("green")).toThrow();
  });
});
