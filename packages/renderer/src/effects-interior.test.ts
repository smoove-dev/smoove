import "./register.js";
import { Block, Composition, Sequence } from "@smoove/core";
import { flameWrap } from "@smoove/effects";
import { beforeAll, describe, expect, it } from "vitest";
import { enableNodeShaderTransitions } from "./gl.js";

/**
 * Every band flameWrap adds to the content — the heat shimmer, the char, the
 * ember line — is measured from the burning front and has to have died out by
 * the middle of a large node. A burning title can never catch a failure here:
 * every part of a glyph is within a few px of an edge, while a 320 px card is
 * 160 px from one, so only the card shows a band that does not fall off.
 *
 * Deliberately extreme settings, and the assertions are on the card's centre.
 */

const WIDTH = 900;
const HEIGHT = 500;
const CARD_W = 600;
const CARD_H = 320;

function buildComp() {
  const comp = new Composition({
    id: "flame-interior",
    width: WIDTH,
    height: HEIGHT,
    fps: 30,
    durationInFrames: 60,
  });
  const seq = new Sequence();
  const card = new Block({
    x: (WIDTH - CARD_W) / 2,
    y: (HEIGHT - CARD_H) / 2,
    width: CARD_W,
    height: CARD_H,
    cornerRadius: 24,
    background: "#ffffff",
  });
  // Deliberately extreme: heavy charring and a wide warp band.
  card.effects([
    flameWrap({
      intensity: 1,
      scorch: 2,
      distortion: 20,
      turbulenceReach: 34,
      melt: 6,
      radius: 24,
      // Explicit, so the tint assertion below reads the colour it was given
      // rather than whatever the default happens to be.
      color: [1, 0.45, 0.1],
    }),
  ]);
  seq.add(card);
  comp.add(seq);
  return comp;
}

function pixel(comp: ReturnType<typeof buildComp>, frame: number, x: number, y: number) {
  comp.setFrame(frame);
  const canvas = comp.captureCanvas();
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const d = ctx.getImageData(x, y, 1, 1).data;
  return { r: d[0] as number, g: d[1] as number, b: d[2] as number, a: d[3] as number };
}

beforeAll(() => {
  enableNodeShaderTransitions();
});

describe("flameWrap leaves a large node's interior alone", () => {
  it("keeps the centre of a white card white despite scorch: 2", () => {
    const centre = pixel(buildComp(), 45, WIDTH / 2, HEIGHT / 2);
    expect(centre.a).toBe(255);
    // Before the fix the centre came back around two thirds brightness.
    expect(centre.r).toBeGreaterThan(245);
    expect(centre.g).toBeGreaterThan(245);
    expect(centre.b).toBeGreaterThan(245);
  });

  it("still burns the edge, so the fix did not just disable the effect", () => {
    const comp = buildComp();
    // A few px above the card's top edge: flames territory.
    const above = pixel(comp, 45, WIDTH / 2, (HEIGHT - CARD_H) / 2 - 10);
    expect(above.a).toBeGreaterThan(0);
    // Warm, not white: fire tint rather than the card's own fill.
    expect(above.r).toBeGreaterThan(above.b);
  });

  it("chars inside the burnt edge but not in the middle", () => {
    const comp = buildComp();
    // 16 px in: past where melt has eaten the card away, inside the char band.
    // The card is white again by ~25 px, which is the point of the next case.
    const edgeInside = pixel(comp, 45, WIDTH / 2, (HEIGHT - CARD_H) / 2 + 16);
    const middle = pixel(comp, 45, WIDTH / 2, HEIGHT / 2);
    expect(edgeInside.r).toBeLessThan(middle.r);
  });
});
