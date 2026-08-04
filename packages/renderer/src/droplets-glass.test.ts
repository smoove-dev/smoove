import "./register.js";
import { Block, Composition, Sequence, Text } from "@smoove/core";
import { droplets } from "@smoove/effects";
import { beforeAll, describe, expect, it } from "vitest";
import { enableNodeShaderTransitions } from "./gl.js";

/**
 * droplets adds no padding: the glass is the node's own box and nothing may
 * reach past it. That claim is worth pixels, because the captured region is
 * *not* the box — its size is snapped up to a 32 px bucket — so a shader that
 * worked in region uv instead of box uv would quietly paint the margin and
 * every node would grow a rectangle.
 *
 * Run on both a big shape and a thin one. A 600x320 card is 160 px from its
 * nearest edge while every part of a glyph is within a few px of one, and the
 * two catch different things: the card catches an interior the rain never
 * reaches, the text catches the effect filling in its transparent gaps.
 */

const WIDTH = 900;
const HEIGHT = 500;
const CARD = { x: 150, y: 90, w: 600, h: 320 };

type Rain = Parameters<typeof droplets>[0];

function buildCard(rain: Rain | null) {
  const comp = new Composition({
    id: "droplets-card",
    width: WIDTH,
    height: HEIGHT,
    fps: 30,
    durationInFrames: 60,
  });
  const seq = new Sequence();
  const card = new Block({
    x: CARD.x,
    y: CARD.y,
    width: CARD.w,
    height: CARD.h,
    background: "#2b5f8f",
  });
  card.add(new Text({ text: "RAIN", fontSize: 96, fontStyle: "bold", fill: "#ffffff" }));
  if (rain) card.effects([droplets(rain)]);
  seq.add(card);
  comp.add(seq);
  return comp;
}

function buildText(rain: Rain | null) {
  const comp = new Composition({
    id: "droplets-text",
    width: 400,
    height: 200,
    fps: 30,
    durationInFrames: 60,
  });
  const seq = new Sequence();
  const title = new Text({
    x: 40,
    y: 60,
    text: "RAIN",
    fontSize: 72,
    fontStyle: "bold",
    fill: "#ffffff",
  });
  if (rain) title.effects([droplets(rain)]);
  seq.add(title);
  comp.add(seq);
  return comp;
}

function pixelsAt(comp: Composition, frame: number): ImageData {
  comp.setFrame(frame);
  const canvas = comp.captureCanvas();
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function at(image: ImageData, x: number, y: number) {
  const i = (y * image.width + x) * 4;
  const d = image.data;
  return { r: d[i] as number, g: d[i + 1] as number, b: d[i + 2] as number, a: d[i + 3] as number };
}

function opaqueCount(image: ImageData): number {
  let n = 0;
  for (let i = 3; i < image.data.length; i += 4) if ((image.data[i] as number) > 8) n++;
  return n;
}

/** Pixels differing from `base` by more than a rounding wobble. */
function changedIn(image: ImageData, base: ImageData, box: typeof CARD): number {
  let n = 0;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const a = at(image, x, y);
      const b = at(base, x, y);
      if (Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 6) n++;
    }
  }
  return n;
}

const RAIN: Rain = { intensity: 1.1, sheen: 1.6, refraction: 0.35, staticDrops: 1 };

beforeAll(() => {
  // Injects the headless-gl platform; without it shader passes are skipped and
  // these assertions would silently test an unrained scene.
  enableNodeShaderTransitions();
});

describe("droplets stays inside the node's box", () => {
  it("leaves the bucket margin around a card transparent", () => {
    const image = pixelsAt(buildCard(RAIN), 40);
    // The region is 600x320 rounded up to 608x320, so a shader working in
    // region uv would paint this 8 px strip. It also spans the bottom edge,
    // where a y-flip mistake would show.
    for (const [x, y] of [
      [CARD.x + CARD.w + 3, CARD.y + 100],
      [CARD.x + CARD.w + 6, CARD.y + CARD.h - 20],
      [CARD.x - 3, CARD.y + 100],
      [CARD.x + 200, CARD.y - 3],
      [CARD.x + 200, CARD.y + CARD.h + 3],
    ] as const) {
      expect(at(image, x, y).a, `painted outside the card at ${x},${y}`).toBe(0);
    }
  });

  it("does not fill in the gaps between glyphs", () => {
    const plain = pixelsAt(buildText(null), 40);
    const rained = pixelsAt(buildText(RAIN), 40);
    // Refraction nudges glyph edges, so this is a bound rather than equality:
    // filling the text's box would multiply the count several times over.
    expect(opaqueCount(rained)).toBeLessThan(opaqueCount(plain) * 1.3);
    expect(opaqueCount(rained)).toBeGreaterThan(opaqueCount(plain) * 0.7);
  });
});

describe("droplets paints rain", () => {
  it("reaches the interior of a large card, not just its edges", () => {
    const plain = pixelsAt(buildCard(null), 40);
    const rained = pixelsAt(buildCard(RAIN), 40);
    const middle = { x: CARD.x + 200, y: CARD.y + 110, w: 200, h: 100 };
    // A band measured from an edge would leave this untouched.
    expect(changedIn(rained, plain, middle)).toBeGreaterThan(200);
  });

  it("moves between frames", () => {
    const comp = buildCard(RAIN);
    const early = pixelsAt(comp, 20);
    const late = pixelsAt(comp, 70);
    expect(changedIn(late, early, CARD)).toBeGreaterThan(200);
  });

  it("costs nothing but the draw when it is switched off", () => {
    const plain = pixelsAt(buildCard(null), 40);
    const off = pixelsAt(buildCard({ intensity: 0 }), 40);
    expect(changedIn(off, plain, CARD)).toBe(0);
  });
});

describe("droplets glass treatments", () => {
  it("darkens the corners under vignette and leaves the centre alone", () => {
    const image = pixelsAt(buildCard({ intensity: 0, vignette: 1 }), 40);
    const corner = at(image, CARD.x + 6, CARD.y + 6);
    const centre = at(image, CARD.x + CARD.w / 2, CARD.y + CARD.h / 2 + 90);
    expect(corner.a).toBe(255);
    expect(corner.b).toBeLessThan(centre.b - 20);
  });

  it("softens content under blur, without dimming the glass", () => {
    const sharp = pixelsAt(buildCard({ intensity: 0 }), 40);
    const fogged = pixelsAt(buildCard({ intensity: 0, blur: 12 }), 40);
    // Count big luminance jumps along a row through the title: blurring the
    // glass has to reduce them, and a row is where a seam would also show.
    const jumps = (image: ImageData, y: number) => {
      let n = 0;
      for (let x = CARD.x + 1; x < CARD.x + CARD.w; x++) {
        if (Math.abs(at(image, x, y).r - at(image, x - 1, y).r) > 40) n++;
      }
      return n;
    };
    // The busiest row of the sharp render: wherever the title's strokes are.
    let row = CARD.y;
    for (let y = CARD.y + 1; y < CARD.y + CARD.h; y++) {
      if (jumps(sharp, y) > jumps(sharp, row)) row = y;
    }
    expect(jumps(sharp, row)).toBeGreaterThan(0);
    expect(jumps(fogged, row)).toBeLessThan(jumps(sharp, row));
    // The fog must not eat the card's own alpha at its edges.
    expect(at(fogged, CARD.x + 2, row).a).toBe(255);
  });
});
