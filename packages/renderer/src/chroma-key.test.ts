import "./register.js";
import { Composition, Group, Rect, Sequence } from "@smoove/core";
import { type ChromaKeyOptions, chromaKey } from "@smoove/effects";
import { beforeAll, describe, expect, it } from "vitest";
import { enableNodeShaderTransitions } from "./gl.js";

/**
 * What chromaKey claims, in pixels: the screen goes, the subject stays, the
 * greys and whites in front of the screen stay, and the green the screen threw
 * onto everything comes off what is left.
 *
 * The screen colour here is a real one, `#3ea346` — a green lit for camera,
 * about a fifth of the way out from neutral. That matters: against a pure
 * `#00ff00` reference every one of these assertions passes with the plain
 * chroma distance too, and the normalization only shows itself on a screen
 * whose colour is as dull as a real one.
 */

const WIDTH = 400;
const HEIGHT = 300;
/** The keyed node's own box. 240 is not a multiple of 32, so the region is taller. */
const SCREEN = { x: 40, y: 30, w: 320, h: 240 };
const SUBJECT = { x: 140, y: 90, w: 120, h: 120 };
/** A white prop in front of the screen: neutral, and the first thing a hot key eats. */
const WHITE = { x: 60, y: 50, w: 40, h: 40 };
/** Dark hair with the screen's green bounced onto it — kept by the key, and spilled. */
const SPILLED = { x: 290, y: 200, w: 50, h: 50 };

const KEY = "#3ea346";
const SUBJECT_FILL = "#e8a0b4";
const SPILLED_FILL = "#3c5023";

function build(key: ChromaKeyOptions | null) {
  const comp = new Composition({
    id: "chroma-key",
    width: WIDTH,
    height: HEIGHT,
    fps: 30,
    durationInFrames: 60,
  });
  const seq = new Sequence();
  const shot = new Group();
  shot.add(new Rect({ x: SCREEN.x, y: SCREEN.y, width: SCREEN.w, height: SCREEN.h, fill: KEY }));
  shot.add(
    new Rect({
      x: SUBJECT.x,
      y: SUBJECT.y,
      width: SUBJECT.w,
      height: SUBJECT.h,
      fill: SUBJECT_FILL,
    }),
  );
  shot.add(new Rect({ x: WHITE.x, y: WHITE.y, width: WHITE.w, height: WHITE.h, fill: "#ffffff" }));
  shot.add(
    new Rect({
      x: SPILLED.x,
      y: SPILLED.y,
      width: SPILLED.w,
      height: SPILLED.h,
      fill: SPILLED_FILL,
    }),
  );
  if (key) shot.effects([chromaKey(key)]);
  seq.add(shot);
  comp.add(seq);
  return comp;
}

function pixelsAt(comp: Composition, frame = 0): ImageData {
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

/** Middle of a box, which is the only place a choke of a few px cannot reach. */
function middleOf(box: { x: number; y: number; w: number; h: number }) {
  return [box.x + box.w / 2, box.y + box.h / 2] as const;
}

function opaqueCount(image: ImageData): number {
  let n = 0;
  for (let i = 3; i < image.data.length; i += 4) if ((image.data[i] as number) > 128) n++;
  return n;
}

/** How far a pixel leans toward the key's hue. Despill is what drives this to zero. */
function greenness(p: { r: number; g: number; b: number }): number {
  return p.g - (p.r + p.b) / 2;
}

beforeAll(() => {
  // Injects the headless-gl platform; without it shader passes are skipped and
  // every assertion here would be testing an unkeyed picture.
  enableNodeShaderTransitions();
});

describe("chromaKey removes the screen", () => {
  it("cuts the screen to nothing", () => {
    const image = pixelsAt(build({ color: KEY }));
    for (const [x, y] of [
      [SCREEN.x + 8, SCREEN.y + 8],
      [SCREEN.x + SCREEN.w - 8, SCREEN.y + 8],
      [SCREEN.x + 20, SCREEN.y + SCREEN.h - 8],
      [SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h - 12],
    ] as const) {
      expect(at(image, x, y).a, `screen survived at ${x},${y}`).toBe(0);
    }
  });

  it("keeps the subject, at its own colour", () => {
    const [x, y] = middleOf(SUBJECT);
    const plain = at(pixelsAt(build(null)), x, y);
    const keyed = at(pixelsAt(build({ color: KEY })), x, y);
    expect(keyed.a).toBe(255);
    // Despill leaves a colour leaning away from the key alone, so this is
    // equality within a rounding wobble rather than a bound.
    expect(Math.abs(keyed.r - plain.r) + Math.abs(keyed.g - plain.g)).toBeLessThan(4);
  });

  it("keeps a white prop, which a distance not normalized by the key would eat", () => {
    // White is 0.2 from this screen's colour in raw chroma and 1.0 in the
    // normalized units the shader uses. Under the raw metric a similarity of
    // 0.5 removes it; under the normalized one nothing below 1 can.
    const [x, y] = middleOf(WHITE);
    const keyed = at(pixelsAt(build({ color: KEY })), x, y);
    expect(keyed.a).toBe(255);
    expect(keyed.r).toBeGreaterThan(250);
  });

  it("leaves the bucket margin around the node transparent", () => {
    // The box is 320x240 and the region 320x256, so a shader working in region
    // uv instead of box uv would paint this strip below the screen.
    const image = pixelsAt(build({ color: KEY, strength: 0.5 }));
    for (const dy of [3, 8, 14]) {
      expect(at(image, SCREEN.x + 100, SCREEN.y + SCREEN.h + dy).a).toBe(0);
    }
  });

  it("costs nothing but the draw when it is switched off", () => {
    const plain = pixelsAt(build(null));
    const off = pixelsAt(build({ color: KEY, strength: 0 }));
    expect(opaqueCount(off)).toBe(opaqueCount(plain));
    const [x, y] = middleOf(SUBJECT);
    expect(at(off, x, y)).toEqual(at(plain, x, y));
  });

  it("crossfades at partial strength, so the background can dissolve away", () => {
    const half = pixelsAt(build({ color: KEY, strength: 0.5 }));
    const screen = at(half, SCREEN.x + 8, SCREEN.y + 8);
    expect(screen.a).toBeGreaterThan(100);
    expect(screen.a).toBeLessThan(155);
  });

  it("gives the same matte on any frame, because it reads no clock", () => {
    const comp = build({ color: KEY });
    expect(Array.from(pixelsAt(comp, 45).data)).toEqual(Array.from(pixelsAt(comp, 0).data));
  });
});

describe("chromaKey despills what it keeps", () => {
  it("takes the screen's cast off a spilled pixel", () => {
    const [x, y] = middleOf(SPILLED);
    // similarity below the default: this patch is dark green enough that a
    // wider key would cut it, and the point here is what despill does to a
    // pixel that survives.
    const kept = at(pixelsAt(build({ color: KEY, similarity: 0.4, spill: 0 })), x, y);
    const clean = at(pixelsAt(build({ color: KEY, similarity: 0.4, spill: 1 })), x, y);
    expect(kept.a).toBe(255);
    expect(clean.a).toBe(255);
    expect(greenness(kept)).toBeGreaterThan(20);
    expect(Math.abs(greenness(clean))).toBeLessThan(6);
  });

  it("holds the pixel's brightness while it does it", () => {
    const [x, y] = middleOf(SPILLED);
    const luma = (p: { r: number; g: number; b: number }) =>
      0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b;
    const kept = pixelsAt(build({ color: KEY, similarity: 0.4, spill: 0 }));
    const clean = pixelsAt(build({ color: KEY, similarity: 0.4, spill: 1 }));
    expect(Math.abs(luma(at(clean, x, y)) - luma(at(kept, x, y)))).toBeLessThan(4);
  });

  it("leaves a colour leaning away from the key alone", () => {
    const [x, y] = middleOf(SUBJECT);
    const none = at(pixelsAt(build({ color: KEY, spill: 0 })), x, y);
    const full = at(pixelsAt(build({ color: KEY, spill: 1 })), x, y);
    expect(full).toEqual(none);
  });
});

describe("chromaKey on a node smaller than a bucket", () => {
  /**
   * A 10x180 strip: the region snaps to 32x192, so most of what the shader runs
   * over is margin rather than node. A box-to-region mapping that is off by a
   * bucket is invisible on a 320px card and glaring here.
   */
  function buildStrip(keyed: boolean) {
    const comp = new Composition({
      id: "chroma-key-strip",
      width: 120,
      height: 240,
      fps: 30,
      durationInFrames: 30,
    });
    const seq = new Sequence();
    const strip = new Group();
    strip.add(new Rect({ x: 40, y: 30, width: 10, height: 180, fill: KEY }));
    strip.add(new Rect({ x: 40, y: 90, width: 10, height: 40, fill: SUBJECT_FILL }));
    if (keyed) strip.effects([chromaKey({ color: KEY })]);
    seq.add(strip);
    comp.add(seq);
    return comp;
  }

  it("keys the strip and paints nothing beside it", () => {
    const image = pixelsAt(buildStrip(true));
    expect(at(image, 45, 40).a).toBe(0);
    expect(at(image, 45, 110).a).toBe(255);
    for (const x of [52, 60, 70]) expect(at(image, x, 110).a).toBe(0);
  });
});

describe("chromaKey chokes the edge", () => {
  it("shrinks the matte on a positive choke and grows it on a negative one", () => {
    const straight = opaqueCount(pixelsAt(build({ color: KEY })));
    const shrunk = opaqueCount(pixelsAt(build({ color: KEY, choke: 4 })));
    const grown = opaqueCount(pixelsAt(build({ color: KEY, choke: -4 })));
    expect(shrunk).toBeLessThan(straight);
    expect(grown).toBeGreaterThan(straight);
  });

  it("only touches the edge, never the middle of what it keeps", () => {
    const [x, y] = middleOf(SUBJECT);
    const image = pixelsAt(build({ color: KEY, choke: 6 }));
    expect(at(image, x, y).a).toBe(255);
  });
});
