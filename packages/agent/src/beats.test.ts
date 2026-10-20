import { describe, expect, it } from "vitest";
import { AgentError, parseAt, resolveAt, sheetFrame, withSheetFrames } from "./index.js";

describe("sheetFrame", () => {
  it("is the beat's last frame when the next beat starts at its end", () => {
    expect(sheetFrame({ start: 0, end: 75 }, 75, 300)).toBe(74);
  });

  it("stops before the next beat comes in when they overlap", () => {
    // The next beat starts 10 frames before this one ends (a transition).
    expect(sheetFrame({ start: 0, end: 100 }, 90, 300)).toBe(89);
  });

  it("ignores a gap after the beat", () => {
    expect(sheetFrame({ start: 0, end: 100 }, 120, 300)).toBe(99);
  });

  it("never passes the composition or comes before the beat", () => {
    expect(sheetFrame({ start: 280, end: 400 }, null, 300)).toBe(299);
    expect(sheetFrame({ start: 50, end: 51 }, 50, 300)).toBe(50);
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
    expect(beats.map((b) => [b.name, b.sheet])).toEqual([
      ["b", 199],
      ["a", 89],
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
    expect(resolveAt("hook", beats)).toBe(64);
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
