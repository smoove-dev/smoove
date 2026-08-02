import { readFileSync } from "node:fs";
import { Composition, Sequence } from "@smoove/core";
import { describe, expect, it } from "vitest";
import { Lottie } from "./index.js";

const probe = JSON.parse(
  readFileSync(new URL("./fixtures/probe.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

/** Alpha-weighted centroid x of the stage, or -1 when nothing is painted. */
function centroidX(comp: Composition): number {
  const canvas = comp.captureCanvas();
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0;
  let weight = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        sum += x * alpha;
        weight += alpha;
      }
    }
  }
  return weight === 0 ? -1 : sum / weight;
}

describe("Lottie in a real composition", () => {
  it("paints, and the animation advances with the frame", async () => {
    const comp = new Composition({
      id: "lottie-render",
      fps: 30,
      durationInFrames: 60,
      width: 200,
      height: 200,
    });
    const seq = new Sequence({ from: 0, durationInFrames: 60 });
    const node = new Lottie({ data: probe, width: 200, height: 200 });
    seq.add(node);
    comp.add(seq);

    // `node.ready` resolves when the animation is decoded; the composition's
    // asset gate settles a microtask later and gates painting until it does.
    await node.ready;
    await comp.whenReady();

    comp.setFrame(0);
    const start = centroidX(comp);

    comp.setFrame(55);
    const end = centroidX(comp);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
  });

  it("is frame-pure — re-seeking a frame repaints it identically", async () => {
    const comp = new Composition({
      id: "lottie-pure",
      fps: 30,
      durationInFrames: 60,
      width: 200,
      height: 200,
    });
    const seq = new Sequence({ from: 0, durationInFrames: 60 });
    const node = new Lottie({ data: probe, width: 200, height: 200 });
    seq.add(node);
    comp.add(seq);
    await node.ready;
    await comp.whenReady();

    comp.setFrame(20);
    const first = centroidX(comp);
    comp.setFrame(50);
    const moved = centroidX(comp);
    comp.setFrame(20);
    const again = centroidX(comp);

    // Guard against a vacuous pass: all three must be real paints, and the
    // playhead must actually have moved between them.
    expect(first).toBeGreaterThan(0);
    expect(moved).toBeGreaterThan(first);
    expect(again).toBeCloseTo(first, 6);
  });
});
