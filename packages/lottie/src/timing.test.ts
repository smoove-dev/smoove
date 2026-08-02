import { describe, expect, it } from "vitest";
import { lottieFrameAt, naturalDurationInFrames, resolveSegment } from "./timing.js";

/** A 24 fps, 48-frame (2 s) animation inside a 30 fps composition. */
const base = {
  fps: 30,
  lottieFps: 24,
  totalFrames: 48,
  trimBefore: 0,
  loop: false,
  speed: 1,
} as const;

describe("naturalDurationInFrames", () => {
  it("converts the animation's length into composition frames", () => {
    // 48 lottie frames / 24 fps = 2 s; 2 s * 30 fps = 60 composition frames.
    expect(naturalDurationInFrames(base)).toBe(60);
  });

  it("returns 0 when either frame rate is unknown", () => {
    expect(naturalDurationInFrames({ ...base, lottieFps: 0 })).toBe(0);
    expect(naturalDurationInFrames({ ...base, fps: 0 })).toBe(0);
  });
});

describe("resolveSegment", () => {
  it("defaults to the whole animation", () => {
    expect(resolveSegment(base)).toEqual([0, 48]);
  });

  it("clamps an explicit segment into range and keeps start <= end", () => {
    expect(resolveSegment({ ...base, segment: [-5, 100] })).toEqual([0, 48]);
    expect(resolveSegment({ ...base, segment: [30, 10] })).toEqual([30, 30]);
  });
});

describe("lottieFrameAt", () => {
  it("resamples the animation's fps onto the composition's clock", () => {
    // Composition frame 15 = 0.5 s = lottie frame 12.
    expect(lottieFrameAt(15, base)).toBeCloseTo(12, 6);
  });

  it("produces fractional frames when the rates do not divide evenly", () => {
    // Composition frame 1 = 1/30 s = lottie frame 0.8.
    expect(lottieFrameAt(1, base)).toBeCloseTo(0.8, 6);
  });

  it("starts at the first frame", () => {
    expect(lottieFrameAt(0, base)).toBeCloseTo(0, 6);
  });

  it("freezes on the last frame past the end when not looping", () => {
    // Well past the 60-composition-frame length.
    expect(lottieFrameAt(200, base)).toBeCloseTo(47, 6);
  });

  it("wraps at the animation's natural length when looping", () => {
    // 60 composition frames per loop; frame 75 is 15 frames in = lottie 12.
    expect(lottieFrameAt(75, { ...base, loop: true })).toBeCloseTo(12, 6);
  });

  it("applies speed", () => {
    // Double speed: composition frame 15 covers 1 s = lottie frame 24.
    expect(lottieFrameAt(15, { ...base, speed: 2 })).toBeCloseTo(24, 6);
  });

  it("offsets by trimBefore, in composition frames", () => {
    // trimBefore 15 composition frames = 0.5 s = lottie frame 12 at local 0.
    expect(lottieFrameAt(0, { ...base, trimBefore: 15 })).toBeCloseTo(12, 6);
  });

  it("honours trimAfter as an exclusive composition-frame bound", () => {
    const t = { ...base, trimAfter: 30 };
    // Freezes at the last frame inside the 30-frame window: lottie frame 23.2.
    expect(lottieFrameAt(100, t)).toBeCloseTo(23.2, 6);
  });

  it("plays inside an explicit segment and stays there", () => {
    const t = { ...base, segment: [24, 48] as [number, number] };
    expect(lottieFrameAt(0, t)).toBeCloseTo(24, 6);
    expect(lottieFrameAt(15, t)).toBeCloseTo(36, 6);
    expect(lottieFrameAt(500, t)).toBeCloseTo(47, 6);
  });

  it("loops inside an explicit segment", () => {
    // A 24-frame segment at 24 fps = 1 s = 30 composition frames per loop.
    const t = { ...base, segment: [24, 48] as [number, number], loop: true };
    expect(lottieFrameAt(45, t)).toBeCloseTo(36, 6);
  });

  it("returns the segment start when the composition fps is unknown", () => {
    expect(lottieFrameAt(10, { ...base, fps: 0 })).toBe(0);
  });
});
