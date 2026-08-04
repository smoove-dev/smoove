import "./register.js";
import { Circle, Composition, Group, Rect, Sequence } from "@smoove/core";
import { type BlurOptions, blur } from "@smoove/effects";
import { beforeAll, describe, expect, it } from "vitest";
import { enableNodeShaderTransitions } from "./gl.js";

/**
 * What blur claims, in pixels, on the server path.
 *
 * The lens kernel only exists here in its real form: `BLUR_LENS_FRAG` is
 * authored as GLSL ES 3.00 and downgraded for headless-gl, which is WebGL1, so
 * this file is the only place the compile is proved before a render. Every
 * assertion below would also pass on a picture with no effect applied at all if
 * the shader failed to compile, which is why the first thing each one checks is
 * that something actually moved.
 *
 * Radius parity across the two kernels is asserted in the unit tests instead:
 * `captureCanvas()` is 1:1 with the composition, so there is no pixelRatio to
 * vary here.
 */

const SIZE = 240;
const CENTRE = SIZE / 2;

/**
 * The source disc for every reach measurement.
 *
 * Deliberately not a point. Blurring a 2px dot by 40px spreads its coverage
 * over 400 times the area, which lands the whole result under any usable alpha
 * threshold — the picture is technically correct and unmeasurable.
 *
 * A disc this size makes the maths exact instead: blurring is a Minkowski sum,
 * and support functions add under one, so the lit area reaches
 * `SOURCE + radius * apertureScale(angle)` in every direction. That is what
 * lets the blade assertions below compare directions rather than guess at
 * absolute numbers.
 */
const SOURCE = 30;

function buildDisc(options: BlurOptions | null, fill = "#ffffff") {
  const comp = new Composition({
    id: "blur-disc",
    width: SIZE,
    height: SIZE,
    fps: 30,
    durationInFrames: 60,
  });
  const seq = new Sequence();
  const group = new Group();
  group.add(new Circle({ x: CENTRE, y: CENTRE, radius: SOURCE, fill }));
  if (options) group.effects([blur(options)]);
  seq.add(group);
  comp.add(seq);
  return comp;
}

/**
 * A dark card carrying one small specular, which is the only arrangement in
 * which bloom is visible at all: on a uniform field every tap weighs the same
 * whatever the knee does.
 */
function buildHighlight(bloom: number) {
  const comp = new Composition({
    id: "blur-highlight",
    width: SIZE,
    height: SIZE,
    fps: 30,
    durationInFrames: 60,
  });
  const seq = new Sequence();
  const group = new Group();
  group.add(new Rect({ x: 40, y: 40, width: 160, height: 160, fill: "#101010" }));
  group.add(new Circle({ x: CENTRE, y: CENTRE, radius: 6, fill: "#ffffff" }));
  group.effects([blur({ type: "lens", radius: 30, bloom })]);
  seq.add(group);
  comp.add(seq);
  return comp;
}

const CARD = { x: 70, y: 90, w: 100, h: 60 };

function buildCard(options: BlurOptions | null) {
  const comp = new Composition({
    id: "blur-card",
    width: SIZE,
    height: SIZE,
    fps: 30,
    durationInFrames: 60,
  });
  const seq = new Sequence();
  const group = new Group();
  group.add(new Rect({ x: CARD.x, y: CARD.y, width: CARD.w, height: CARD.h, fill: "#101010" }));
  if (options) group.effects([blur(options)]);
  seq.add(group);
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
  const i = (Math.round(y) * image.width + Math.round(x)) * 4;
  const d = image.data;
  return { r: d[i] as number, g: d[i + 1] as number, b: d[i + 2] as number, a: d[i + 3] as number };
}

/**
 * How far the lit area extends from the centre along one direction.
 *
 * The tap dither leaves the outer edge grainy rather than clean, so this takes
 * the last radius that was lit and keeps walking a little past it rather than
 * stopping at the first transparent sample.
 */
function reach(image: ImageData, angleDeg: number, threshold = 1): number {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  let last = 0;
  let misses = 0;
  for (let r = 0; r <= 110; r += 0.5) {
    const lit = at(image, CENTRE + dx * r, CENTRE + dy * r).a > threshold;
    if (lit) {
      last = r;
      misses = 0;
    } else if (++misses > 12) break;
  }
  return last;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Mean reach toward a hexagonal aperture's vertices and across its edge
 * midpoints. Averaging six directions each pulls the per-direction dither noise
 * (about +/-1.5px) down to well under the difference being measured.
 */
function apertureProfile(image: ImageData) {
  return {
    vertex: mean([0, 60, 120, 180, 240, 300].map((a) => reach(image, a))),
    edge: mean([30, 90, 150, 210, 270, 330].map((a) => reach(image, a))),
  };
}

function litBeyond(image: ImageData, distance: number): number {
  let worst = 0;
  for (let angle = 0; angle < 360; angle += 5) {
    const rad = (angle * Math.PI) / 180;
    for (let r = distance; r <= distance + 20; r += 1) {
      const x = CENTRE + Math.cos(rad) * r;
      const y = CENTRE + Math.sin(rad) * r;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) break;
      worst = Math.max(worst, at(image, x, y).a);
    }
  }
  return worst;
}

beforeAll(() => {
  // Injects the headless-gl platform. Without it the lens pass is skipped and
  // every assertion about it would be testing a sharp picture.
  enableNodeShaderTransitions();
});

describe("blur softens", () => {
  it("turns a hard edge into a ramp, which is the css path running at all", () => {
    const sharp = pixelsAt(buildCard(null));
    const soft = pixelsAt(buildCard({ radius: 20 }));

    // Just outside the card: nothing there before, a partial edge after.
    expect(at(sharp, CARD.x - 6, CARD.y + 30).a).toBe(0);
    expect(at(soft, CARD.x - 6, CARD.y + 30).a).toBeGreaterThan(20);

    // On the edge itself: fully covered before, about half after.
    expect(at(sharp, CARD.x + 1, CARD.y + 30).a).toBe(255);
    const edge = at(soft, CARD.x + 1, CARD.y + 30).a;
    expect(edge).toBeGreaterThan(70);
    expect(edge).toBeLessThan(190);
  });

  it("leaves the middle of a card it cannot reach across alone", () => {
    const soft = pixelsAt(buildCard({ radius: 20 }));
    expect(at(soft, CARD.x + CARD.w / 2, CARD.y + CARD.h / 2).a).toBeGreaterThan(250);
  });

  it("costs nothing but the draw when it is switched off", () => {
    const sharp = pixelsAt(buildCard(null));
    const off = pixelsAt(buildCard({ radius: 0 }));
    expect(Array.from(off.data)).toEqual(Array.from(sharp.data));
  });

  it("decays to nothing well inside the padding it asked for", () => {
    // padding is 2 * radius = 40, so 46px past the card's edge is past the
    // region boundary too. A term that had not decayed by there would show up
    // as the rectangle around the node this is guarding against.
    const soft = pixelsAt(buildCard({ radius: 20 }));
    for (const dx of [46, 52, 60]) {
      expect(at(soft, CARD.x - dx, CARD.y + 30).a, `lit ${dx}px left of the card`).toBe(0);
      expect(at(soft, CARD.x + CARD.w + dx, CARD.y + 30).a).toBe(0);
    }
  });
});

describe("blur type lens", () => {
  it("spreads a disc by the radius it was asked for", () => {
    const sharp = pixelsAt(buildDisc(null));
    const lens = pixelsAt(buildDisc({ type: "lens", radius: 40, bloom: 0 }));

    expect(Math.abs(reach(sharp, 0) - SOURCE)).toBeLessThan(2);
    // Coverage tails off over the last few px — the outermost taps are the only
    // ones that get there — so a threshold-based reach always reads a little
    // short of the true SOURCE + 40.
    expect(reach(lens, 0)).toBeGreaterThan(SOURCE + 40 - 7);
    expect(reach(lens, 0)).toBeLessThan(SOURCE + 40 + 2);
  });

  it("is isotropic — a disc, not a diamond or a chamfered box", () => {
    const lens = pixelsAt(buildDisc({ type: "lens", radius: 40, bloom: 0 }));
    const axes = [0, 90, 180, 270].map((a) => reach(lens, a));
    const diagonals = [45, 135, 225, 315].map((a) => reach(lens, a));

    // Averaged, because a single direction carries about +/-1.5px of dither.
    // A chamfer metric would put the diagonals 29% short — 11px on this
    // radius — so nothing subtle is being waved through here.
    expect(Math.abs(mean(axes) - mean(diagonals))).toBeLessThan(2);

    const all = [...axes, ...diagonals];
    expect(Math.max(...all) - Math.min(...all)).toBeLessThan(6);
  });

  it("stops at the disc's edge and paints no rectangle at the region boundary", () => {
    const lens = pixelsAt(buildDisc({ type: "lens", radius: 40, bloom: 0 }));
    expect(litBeyond(lens, SOURCE + 40 + 4)).toBe(0);
  });

  it("gives the same pixels on any frame, because it reads no clock", () => {
    const comp = buildDisc({ type: "lens", radius: 30 });
    expect(Array.from(pixelsAt(comp, 45).data)).toEqual(Array.from(pixelsAt(comp, 0).data));
  });
});

describe("blur bloom", () => {
  /**
   * The whole reason the lens kernel exists next to a CSS blur: a flat average
   * dilutes a specular as it spreads, a weighted one lets it dominate the disc
   * it spreads into. Sampled half way out from the highlight, where a flat disc
   * has already averaged it down into the card and the knee has not.
   */
  function brightnessAt(bloom: number): number {
    return at(pixelsAt(buildHighlight(bloom)), CENTRE + 14, CENTRE).r;
  }

  it("holds a highlight brighter than a flat disc does", () => {
    const flat = brightnessAt(0);
    const bloomed = brightnessAt(1);
    expect(flat).toBeGreaterThan(0);
    expect(bloomed).toBeGreaterThan(flat + 20);
  });

  it("is monotonic, so animating it is a dial rather than a switch", () => {
    const values = [0, 0.5, 1].map(brightnessAt);
    expect(values[1] as number).toBeGreaterThan(values[0] as number);
    expect(values[2] as number).toBeGreaterThan(values[1] as number);
  });

  it("never brightens past what it read, so the straight-alpha divide cannot clip", () => {
    const image = pixelsAt(buildHighlight(1));
    for (let x = CENTRE - 40; x <= CENTRE + 40; x++) {
      expect(at(image, x, CENTRE).r).toBeLessThanOrEqual(255);
    }
  });
});

describe("blur blades", () => {
  /**
   * A polygon inscribed in the aperture circle reaches the full radius at a
   * vertex and only cos(PI/n) of it at an edge midpoint. With six blades and no
   * rotation the vertices sit on the axes, so 0 deg is a vertex and 30 deg is
   * an edge midpoint.
   *
   * Blurring is a Minkowski sum, so the source's own radius adds to the
   * kernel's reach in every direction and subtracts straight back out here.
   */
  it("reaches further at a vertex than across an edge", () => {
    const { vertex, edge } = apertureProfile(
      pixelsAt(buildDisc({ type: "lens", radius: 40, bloom: 0, blades: 6 })),
    );
    expect(vertex).toBeGreaterThan(edge + 1.2);
    // The full theoretical modulation would put the edge at
    // (SOURCE + 40*cos(PI/6)) / (SOURCE + 40), which is 0.92. Only about half
    // of that survives: the boundary is reached by the handful of outermost
    // taps alone, and their sparseness rounds the polygon off. Real, measurable
    // and subtle — see the docs, which say so rather than promising a crisp
    // hexagon.
    expect(edge / vertex).toBeGreaterThan(0.92);
    expect(edge / vertex).toBeLessThan(0.985);
  });

  it("is round again below three blades", () => {
    const { vertex, edge } = apertureProfile(
      pixelsAt(buildDisc({ type: "lens", radius: 40, bloom: 0, blades: 2 })),
    );
    expect(Math.abs(vertex - edge)).toBeLessThan(1);
  });

  it("turns with bladeAngle, so the bokeh can be oriented", () => {
    // 30 degrees of rotation puts an edge midpoint where a vertex was, so the
    // two measurements swap over.
    const { vertex, edge } = apertureProfile(
      pixelsAt(buildDisc({ type: "lens", radius: 40, bloom: 0, blades: 6, bladeAngle: 30 })),
    );
    expect(edge).toBeGreaterThan(vertex + 1.2);
  });
});

describe("blur on a thin shape", () => {
  /**
   * A 4px strip: every pixel in it is within 2px of an edge, so the
   * premultiplied divide runs entirely on taps that straddle the alpha
   * boundary — a completely different regime from a card's interior, where
   * every tap is opaque.
   */
  function buildStrip(options: BlurOptions | null) {
    const comp = new Composition({
      id: "blur-strip",
      width: 120,
      height: 200,
      fps: 30,
      durationInFrames: 30,
    });
    const seq = new Sequence();
    const group = new Group();
    group.add(new Rect({ x: 58, y: 40, width: 4, height: 120, fill: "#ffffff" }));
    if (options) group.effects([blur(options)]);
    seq.add(group);
    comp.add(seq);
    return comp;
  }

  function rowSpread(image: ImageData, y: number, threshold = 8) {
    let lo = -1;
    let hi = -1;
    for (let x = 0; x < image.width; x++) {
      if (at(image, x, y).a > threshold) {
        if (lo < 0) lo = x;
        hi = x;
      }
    }
    return { lo, hi, centre: (lo + hi) / 2 };
  }

  it("spreads a strip both ways without shifting it", () => {
    for (const options of [{ radius: 12 }, { type: "lens" as const, radius: 12, bloom: 0 }]) {
      const label = options.type ?? "gaussian";
      const sharp = rowSpread(pixelsAt(buildStrip(null)), 100);
      const soft = rowSpread(pixelsAt(buildStrip(options)), 100);
      expect(soft.hi - soft.lo, `${label} did not spread`).toBeGreaterThan(sharp.hi - sharp.lo + 8);
      expect(Math.abs(soft.centre - sharp.centre), `${label} shifted the strip`).toBeLessThan(1.5);
    }
  });

  it("keeps white white rather than dragging transparency into it", () => {
    // Premultiplied accumulation is what stops the colour being averaged with
    // the black of the zeroed transparent texels beside the strip.
    const soft = pixelsAt(buildStrip({ type: "lens", radius: 12, bloom: 0 }));
    const middle = at(soft, 60, 100);
    // A 4px strip spread over a 24px disc keeps about a sixth of its coverage.
    expect(middle.a).toBeGreaterThan(30);
    expect(middle.r).toBeGreaterThan(250);
    expect(middle.g).toBeGreaterThan(250);
    expect(middle.b).toBeGreaterThan(250);
  });
});
