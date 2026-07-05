import { describe, expect, it } from "vitest";
import {
  defaultsFromSchema,
  type ParamSchema,
  paramsToUniforms,
  parseColorVec4,
} from "../src/params.js";

const CTX = { frame: 30, time: 1, fps: 30, width: 100, height: 50, pixelRatio: 1 };

describe("parseColorVec4", () => {
  it("parses hex", () => {
    expect(parseColorVec4("#ff0000")).toEqual([1, 0, 0, 1]);
    expect(parseColorVec4("#0f0")).toEqual([0, 1, 0, 1]);
    expect(parseColorVec4("#0000ff80")[3]).toBeCloseTo(0.5, 1);
  });
  it("parses rgb()/rgba()", () => {
    expect(parseColorVec4("rgb(255, 0, 0)")).toEqual([1, 0, 0, 1]);
    expect(parseColorVec4("rgba(0, 255, 0, 0.5)")).toEqual([0, 1, 0, 0.5]);
  });
});

describe("paramsToUniforms", () => {
  const schema: ParamSchema = {
    radius: { type: "number", uniform: "u_radius", default: 10, min: 0, max: 100 },
    color: { type: "color", uniform: "u_color", default: "#ffffff" },
    colors: { type: "colors", uniform: "u_colors", default: ["#000", "#fff"], max: 8 },
    angle: { type: "number", uniform: "u_angle", default: 0, unit: "deg" },
    speed: { type: "number", uniform: null, default: 2 },
  };
  it("maps values, converts colors/degrees, injects u_time from speed", () => {
    const u = paramsToUniforms(schema, defaultsFromSchema(schema), CTX);
    expect(u.u_radius).toBe(10);
    expect(u.u_color).toEqual([1, 1, 1, 1]);
    expect(u.u_colors).toEqual([
      [0, 0, 0, 1],
      [1, 1, 1, 1],
    ]);
    expect(u.u_colorsCount).toBe(2);
    expect(u.u_angle).toBe(0);
    expect(u.u_time).toBe(2); // time(1s) * speed(2)
    expect("u_speed" in u).toBe(false); // uniform: null params don't emit
  });
  it("converts degrees to radians", () => {
    const u = paramsToUniforms(schema, { ...defaultsFromSchema(schema), angle: 180 }, CTX);
    expect(u.u_angle).toBeCloseTo(Math.PI);
  });
});
