import { describe, expect, it } from "vitest";
import { Composition } from "../engine/composition.js";
import { plan } from "../engine/marker.js";
import { Sequence } from "../engine/sequence.js";
import type { CheckBeat } from "./findings.js";
import { checkBeats, isHeldFrame, sampleFrames } from "./sampling.js";

const beats: CheckBeat[] = [
  { name: "hook", start: 0, settled: 10, end: 100, sheet: 99 },
  { name: "land", start: 100, settled: 112, end: 300, sheet: 299 },
];

describe("sampleFrames", () => {
  it("steps by a tenth of a second and keeps every beat's key frames", () => {
    const frames = sampleFrames(300, 30, beats, "sweep");
    for (const f of [0, 3, 6, 10, 99, 100, 112, 299]) expect(frames).toContain(f);
    expect(frames).not.toContain(4);
    expect([...frames].sort((a, b) => a - b)).toEqual(frames);
    expect(new Set(frames).size).toBe(frames.length);
  });

  it("steps by half a second for contrast", () => {
    const frames = sampleFrames(300, 30, beats, "contrast");
    expect(frames).toContain(15);
    expect(frames).not.toContain(3);
    expect(frames).toContain(112);
  });

  it("steps by six frames at 60 frames a second", () => {
    const frames = sampleFrames(600, 60, [], "sweep");
    expect(frames.slice(0, 3)).toEqual([0, 6, 12]);
    expect(frames.at(-1)).toBe(599);
  });
});

describe("isHeldFrame", () => {
  it("is true inside a settled stretch, both ends included", () => {
    expect(isHeldFrame(10, beats)).toBe(true);
    expect(isHeldFrame(99, beats)).toBe(true);
    expect(isHeldFrame(5, beats)).toBe(false);
    expect(isHeldFrame(105, beats)).toBe(false);
  });
});

describe("checkBeats", () => {
  it("reads the plan, with the contact sheet's frames", () => {
    const beatsPlan = plan({
      hook: { durationInFrames: 60 },
      land: { durationInFrames: 90, offset: -15 },
      outro: { durationInFrames: 45 },
    });
    const comp = new Composition({
      id: "sampling-plan",
      fps: 30,
      width: 320,
      height: 180,
      durationInFrames: beatsPlan.outro.end,
      plan: beatsPlan,
    });
    const got = checkBeats(comp);
    expect(got.map((b) => b.name)).toEqual(["hook", "land", "outro"]);
    // Same rule as @smoove/agent's sheetFrame: one before the earlier of the
    // beat's end and the next beat's start.
    expect(got[0]?.sheet).toBe((got[1]?.start ?? 0) - 1);
    expect(got[2]?.sheet).toBe(comp.durationInFrames.get() - 1);
  });

  it("falls back to top-level sequences", () => {
    const comp = new Composition({
      id: "sampling-seq",
      fps: 30,
      width: 320,
      height: 180,
      durationInFrames: 120,
    });
    comp.add(new Sequence({ name: "a", from: 0, durationInFrames: 60 }));
    comp.add(new Sequence({ name: "b", from: 60, durationInFrames: 60 }));
    const got = checkBeats(comp);
    expect(got).toEqual([
      { name: "a", start: 0, settled: 0, end: 60, sheet: 59 },
      { name: "b", start: 60, settled: 60, end: 120, sheet: 119 },
    ]);
  });
});
