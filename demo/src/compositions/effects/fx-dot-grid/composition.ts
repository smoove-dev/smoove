import { type Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { DotGrid } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * HALF/TONE — a print-shop poster proofing itself. The grid breathes, the
 * stamp cycles through all four die shapes (circle → diamond → square →
 * triangle), and randomized size/opacity sweep in like a mis-registered
 * press pass. DotGrid is static by design — every move here is a param.
 */
const comp: Composition = makeComp("fx-dot-grid");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#f2ede3" }));

const grid = new DotGrid({
  width: W,
  height: H,
  colorBack: "#f2ede3",
  colorFill: "#1d1b16",
  colorStroke: "#e0452c",
  dotSize: 9,
  gapX: 46,
  gapY: 46,
  lineWidth: 0,
  sizeRange: 0,
  opacityRange: 0,
  shape: "circle",
});
scene.add(grid);

const title = new Text({
  x: 70,
  y: 220,
  text: "HALF\nTONE",
  fontSize: 150,
  fontStyle: "bold",
  fill: "#e0452c",
  lineHeight: 0.95,
  letterSpacing: 4,
});
scene.add(title);

const spec = new Text({
  x: 74,
  y: 560,
  text: "die: circle · 46pt grid",
  fontSize: 24,
  fontFamily: "monospace",
  fill: "#1d1b16",
  letterSpacing: 2,
});
scene.add(spec);

const SHAPES = ["circle", "diamond", "square", "triangle"] as const;

scene.register((f) => {
  const t = f % DURATION;
  // A new die every quarter.
  const idx = Math.min(3, Math.floor(t / (DURATION / 4)));
  grid.shape(SHAPES[idx] as (typeof SHAPES)[number]);
  // The press breathes: grid density swells and relaxes once per die.
  const local = (t % (DURATION / 4)) / (DURATION / 4);
  const swell = interpolate(local, [0, 0.5, 1], [0, 1, 0], { easing: Easing.inOut(Easing.quad) });
  grid.gapX(46 - 14 * swell);
  grid.gapY(46 - 14 * swell);
  grid.dotSize(9 + 7 * swell);
  // Mis-registration sweeps in during the second half of each die pass.
  grid.sizeRange(
    interpolate(local, [0.5, 0.9], [0, 0.7], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  grid.opacityRange(
    interpolate(local, [0.5, 0.9], [0, 0.5], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  spec.setText(`die: ${SHAPES[idx]} · ${Math.round(46 - 14 * swell)}pt grid`);
});

comp.add(scene);

export default comp;
