// Headless tests for the sample composition. A composition is a pure function
// of the frame, so you can drive it to any frame and assert what is on screen:
// no browser, no render. Run them with `npm test`.
import { probeAt } from "@smoove/core/testing";
import { beforeAll, describe, expect, it } from "vitest";
import comp from "./composition";

// Fonts load asynchronously; measure against the real face, not a fallback.
beforeAll(async () => {
  await comp.whenReady();
});

describe("hello-smoove", () => {
  it("runs for four seconds", () => {
    expect(comp.durationInFrames.get() / comp.fps).toBe(4);
  });

  it("pops the dot in over the first frames", () => {
    expect(probeAt(comp, 0, ".dot")[0]?.box.width).toBe(0);
    // Pick a frame after the entrance, not its first frame.
    expect(probeAt(comp, 10, ".dot")[0]?.box.width).toBeGreaterThan(30);
  });

  it("settles the wordmark into the lockup by the end", () => {
    const [wordmark] = probeAt(comp, { time: 3.5 }, ".wordmark");
    expect(wordmark?.visible).toBe(true);
    expect(wordmark?.box.x).toBeCloseTo(510, 0);
  });
});
