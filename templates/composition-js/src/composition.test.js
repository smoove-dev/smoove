// Headless tests for the sample composition. A composition is a pure function
// of the frame, so you can drive it to any frame and assert what is on screen:
// no browser, no render. Run them with `npm test`.
import { probe, runChecks } from "@smoove/core/testing";
import { beforeAll, describe, expect, it } from "vitest";
import comp, { beats } from "./composition";
import checks from "./composition.check";

// Fonts load asynchronously; measure against the real face, not a fallback.
beforeAll(async () => {
  await comp.whenReady();
});

describe("hello-smoove", () => {
  it("runs for four seconds", () => {
    expect(comp.durationInFrames.get() / comp.fps).toBe(4);
  });

  it("pops the dot in over the first frames", () => {
    // Drive the clock to a frame, then probe what is on screen there.
    comp.setFrame(0);
    expect(probe(comp, ".dot")[0]?.box.width).toBe(0);
    // Pick a frame after the entrance, not its first frame.
    comp.setFrame(10);
    expect(probe(comp, ".dot")[0]?.box.width).toBeGreaterThan(30);
  });

  it("settles the wordmark into the lockup by the end", () => {
    // Beats have names, so a test can ask for "the last frame of the slogan".
    comp.setFrame(beats.slogan.end.resolve() - 1);
    const [wordmark] = probe(comp, ".wordmark");
    expect(wordmark?.visible).toBe(true);
    expect(wordmark?.box.x).toBeCloseTo(510, 0);
  });

  it("passes its checks", async () => {
    // The same checks `npx smoove check` runs. Errors fail the test; warnings
    // are left to the command's report.
    const report = await runChecks(comp, checks);
    expect(report.findings.filter((f) => f.severity === "error")).toEqual([]);
  });
});
