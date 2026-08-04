import "./register.js";
import { Block, Composition, Sequence, Text } from "@smoove/core";
import { droplets, type FlameWrapShape, flameWrap } from "@smoove/effects";
import { beforeAll, describe, expect, it } from "vitest";
import { enableNodeShaderTransitions } from "./gl.js";

/**
 * The test the whole design exists to make passable: flameWrap must be
 * frame-pure. Rendering frame N cold has to equal reaching frame N by playing
 * forward, or the studio cannot scrub and a distributed render cannot split.
 *
 * Run for both shapes. The silhouette one carries a cache — the distance field,
 * keyed on contentVersion — and a cache is state, which is precisely what makes
 * a cold frame differ from a stepped one when it is keyed wrong.
 */

function buildComp(shape: FlameWrapShape = "box") {
  const comp = new Composition({
    id: "flame-determinism",
    width: 320,
    height: 180,
    fps: 30,
    durationInFrames: 120,
  });
  const seq = new Sequence({ from: 0, durationInFrames: 120 });
  const title = new Text({
    x: 60,
    y: 70,
    text: "BURN",
    fontSize: 48,
    fill: "white",
  });
  title.setAttr("effects", [flameWrap({ intensity: 0.9, height: 60, shape })]);
  seq.add(title);
  comp.add(seq);
  return comp;
}

function pixelsAt(comp: ReturnType<typeof buildComp>, frame: number): Uint8ClampedArray {
  comp.setFrame(frame);
  const canvas = comp.captureCanvas();
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

function hashAt(comp: ReturnType<typeof buildComp>, frame: number): string {
  const data = pixelsAt(comp, frame);
  let h = 0;
  for (let i = 0; i < data.length; i++) h = (h * 31 + (data[i] as number)) | 0;
  return String(h);
}

function opaqueCount(data: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if ((data[i] as number) > 0) n++;
  return n;
}

beforeAll(() => {
  // Injects the headless-gl platform; without it shader passes are skipped and
  // these assertions would silently test an unlit scene.
  enableNodeShaderTransitions();
});

describe.each(["box", "silhouette"] as const)("flameWrap determinism (%s)", (shape) => {
  it("renders something", () => {
    const data = pixelsAt(buildComp(shape), 45);
    expect(opaqueCount(data)).toBeGreaterThan(0);
  });

  it("frame 90 cold equals frame 90 stepped", () => {
    const cold = hashAt(buildComp(shape), 90);
    const warm = buildComp(shape);
    for (let frame = 0; frame <= 90; frame++) warm.setFrame(frame);
    expect(hashAt(warm, 90)).toBe(cold);
  });

  it("differs across frames, so it is actually animating", () => {
    const comp = buildComp(shape);
    expect(hashAt(comp, 30)).not.toBe(hashAt(comp, 60));
  });

  it("is reproducible across separate compositions at the same frame", () => {
    expect(hashAt(buildComp(shape), 42)).toBe(hashAt(buildComp(shape), 42));
  });

  it("paints outside the text's own box, so flames really escape it", () => {
    const comp = buildComp(shape);
    comp.setFrame(50);
    const canvas = comp.captureCanvas();
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    // Well above the glyph tops: only reachable via the padded flame region.
    const band = ctx.getImageData(60, 30, 140, 20).data;
    expect(opaqueCount(band)).toBeGreaterThan(0);
  });
});

/**
 * The same proof for droplets, which gave up the most to earn it: the reference
 * wiped drops away under the pointer with a trail texture accumulated frame
 * over frame, and a cache like that is precisely what makes a cold frame differ
 * from a stepped one.
 */
function buildRainComp() {
  const comp = new Composition({
    id: "droplets-determinism",
    width: 320,
    height: 180,
    fps: 30,
    durationInFrames: 120,
  });
  const seq = new Sequence({ from: 0, durationInFrames: 120 });
  const card = new Block({
    x: 20,
    y: 20,
    width: 280,
    height: 140,
    background: "#3a6ea5",
  });
  card.setAttr("effects", [droplets({ intensity: 1, blur: 5, sheen: 1.4 })]);
  seq.add(card);
  comp.add(seq);
  return comp;
}

describe("droplets determinism", () => {
  it("renders something", () => {
    expect(opaqueCount(pixelsAt(buildRainComp(), 45))).toBeGreaterThan(0);
  });

  it("frame 90 cold equals frame 90 stepped", () => {
    const cold = hashAt(buildRainComp(), 90);
    const warm = buildRainComp();
    for (let frame = 0; frame <= 90; frame++) warm.setFrame(frame);
    expect(hashAt(warm, 90)).toBe(cold);
  });

  it("differs across frames, so the rain is actually falling", () => {
    const comp = buildRainComp();
    expect(hashAt(comp, 30)).not.toBe(hashAt(comp, 60));
  });

  it("is reproducible across separate compositions at the same frame", () => {
    expect(hashAt(buildRainComp(), 42)).toBe(hashAt(buildRainComp(), 42));
  });
});
