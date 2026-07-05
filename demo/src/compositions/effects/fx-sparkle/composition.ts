import { type Composition, Rect, Sequence, Text } from "@smoove/core";
import { ShineEffect, SparkleEffect } from "@smoove/effects";
import { H, makeComp, phase, W } from "../_shared.js";

/**
 * SPARKLE — a jewelry counter. SparkleEffect scatters twinkling glints over
 * the lettering; effects chain, so a slow ShineEffect sweep passes through
 * the same glyphs and the two read as one lit vitrine. The register callback
 * only swells the sparkle when the sweep is mid-word.
 */
const comp: Composition = makeComp("fx-sparkle");
const scene = new Sequence();

// Deep velvet with a soft spotlight pool behind the word.
scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#120a18" }));
scene.add(
  new Rect({
    x: W / 2 - 420,
    y: 140,
    width: 840,
    height: 360,
    cornerRadius: 420,
    fillRadialGradientStartPoint: { x: 420, y: 180 },
    fillRadialGradientEndPoint: { x: 420, y: 180 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: 420,
    fillRadialGradientColorStops: [0, "#2a1a38", 1, "#120a18"],
  }),
);

const glints = new SparkleEffect({ density: 18, size: 5, intensity: 1.1 });
const sweep = new ShineEffect({ color: "#f6e7ff", width: 0.14, period: 8, intensity: 0.7 });
scene.add(
  new Text({
    x: 0,
    y: 260,
    width: W,
    text: "DIAMANT",
    fontSize: 132,
    fontStyle: "bold",
    align: "center",
    fill: "#e9e2f2",
    letterSpacing: 22,
    effects: [glints, sweep],
  }),
);

scene.add(
  new Text({
    x: 0,
    y: 470,
    width: W,
    text: "CUT · CLARITY · CARAT",
    fontSize: 28,
    align: "center",
    fill: "#7d6a92",
    letterSpacing: 12,
    effects: [new SparkleEffect({ density: 10, size: 3, intensity: 0.8 })],
  }),
);

scene.register((f) => {
  // The glints surge as the gloss band crosses the word (one sweep per loop).
  const sweepMid = Math.exp(-((phase(f) - 0.5) ** 2) / 0.02);
  glints.intensity(1.1 + 1.2 * sweepMid);
});

comp.add(scene);

export default comp;
