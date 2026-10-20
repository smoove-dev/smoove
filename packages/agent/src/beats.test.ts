import { describe, expect, it } from "vitest";
import {
  AgentError,
  heldToFrame,
  parseAt,
  resolveAt,
  sheetFrame,
  withSheetFrames,
} from "./index.js";

describe("heldToFrame", () => {
  it("is the beat's last frame when the next beat starts at its end", () => {
    expect(heldToFrame({ start: 0, end: 75 }, 75, 300)).toBe(74);
  });

  it("stops before the next beat comes in when they overlap", () => {
    // The next beat starts 10 frames before this one ends (a transition).
    expect(heldToFrame({ start: 0, end: 100 }, 90, 300)).toBe(89);
  });

  it("ignores a gap after the beat", () => {
    expect(heldToFrame({ start: 0, end: 100 }, 120, 300)).toBe(99);
  });

  it("never passes the composition or comes before the beat", () => {
    expect(heldToFrame({ start: 280, end: 400 }, null, 300)).toBe(299);
    expect(heldToFrame({ start: 50, end: 51 }, 50, 300)).toBe(50);
  });
});

describe("sheetFrame", () => {
  it("is two thirds of the way from settled to the held-to frame", () => {
    // Held from 0 to 89: the tile is past the entrance, before a fade out.
    expect(sheetFrame({ start: 0, settled: 0, end: 90 }, 90, 300)).toBe(59);
    expect(sheetFrame({ start: 90, settled: 120, end: 300 }, null, 300)).toBe(239);
  });

  it("stays inside a one-frame beat and inside the composition", () => {
    expect(sheetFrame({ start: 50, settled: 50, end: 51 }, 51, 300)).toBe(50);
    expect(sheetFrame({ start: 280, settled: 290, end: 400 }, null, 300)).toBe(296);
  });

  it("never comes before the held stretch, even when settled is past it", () => {
    expect(sheetFrame({ start: 0, settled: 95, end: 100 }, 90, 300)).toBe(89);
  });
});

describe("withSheetFrames", () => {
  it("uses the next beat in time, whatever order the beats come in", () => {
    const beats = withSheetFrames(
      [
        { name: "b", start: 90, settled: 100, end: 200 },
        { name: "a", start: 0, settled: 0, end: 100 },
      ],
      200,
    );
    expect(beats.map((b) => [b.name, b.heldTo, b.sheet])).toEqual([
      ["b", 199, 166],
      ["a", 89, 59],
    ]);
  });
});

describe("--at", () => {
  const beats = withSheetFrames(
    [
      { name: "hook", start: 0, settled: 0, end: 75 },
      { name: "v1.2", start: 65, settled: 75, end: 150 },
    ],
    150,
  );

  it("splits the point off the last dot", () => {
    expect(parseAt("hook")).toEqual({ beat: "hook", point: "sheet" });
    expect(parseAt("hook.start")).toEqual({ beat: "hook", point: "start" });
    expect(parseAt("v1.2.settled")).toEqual({ beat: "v1.2", point: "settled" });
    expect(parseAt("v1.2")).toEqual({ beat: "v1.2", point: "sheet" });
  });

  it("resolves each point to a frame", () => {
    expect(resolveAt("hook", beats)).toBe(43);
    expect(resolveAt("hook.start", beats)).toBe(0);
    expect(resolveAt("hook.last", beats)).toBe(74);
    expect(resolveAt("hook.end", beats)).toBe(75);
    expect(resolveAt("v1.2.settled", beats)).toBe(75);
  });

  it("names the beats that exist when one is unknown", () => {
    try {
      resolveAt("outro", beats);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AgentError);
      expect((err as AgentError).code).toBe("unknown-beat");
      expect((err as AgentError).message).toContain("hook, v1.2");
    }
  });
});
