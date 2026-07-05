import { type Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import { SimplexNoise } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * ELEVATION — a survey map drawing its contours. SimplexNoise starts as a
 * smooth flowing gradient, then stepsPerColor quantizes it into crisp
 * altitude bands — a live topographic map — before melting smooth again.
 */
const comp: Composition = makeComp("fx-simplex-noise");
const scene = new Sequence();

const terrain = new SimplexNoise({
  width: W,
  height: H,
  colors: ["#0b3d2e", "#2e7d4f", "#93b56e", "#e0d3a1", "#8a6f4b", "#f2efe8"],
  stepsPerColor: 1,
  softness: 1,
  speed: 0.35,
});
scene.add(terrain);

const title = new Text({
  x: 56,
  y: 48,
  text: "ELEVATION",
  fontSize: 44,
  fontStyle: "bold",
  fill: "#10241a",
  letterSpacing: 10,
});
scene.add(title);

const legend = new Text({
  x: 56,
  y: 106,
  text: "survey · smooth",
  fontSize: 22,
  fontFamily: "monospace",
  fill: "#1d3a2b",
  letterSpacing: 3,
});
scene.add(legend);

scene.register((f) => {
  const t = f % DURATION;
  // Quantize: smooth → banded topo → smooth. Softness inverts with it so
  // the bands land razor-sharp.
  const bands = interpolate(t, [60, 200, 360, 460], [1, 6, 6, 1], {
    easing: Easing.inOut(Easing.cubic),
  });
  terrain.stepsPerColor(Math.round(bands));
  terrain.softness(interpolate(bands, [1, 6], [1, 0.05]));
  legend.setText(
    Math.round(bands) <= 1 ? "survey · smooth" : `survey · ${Math.round(bands)} bands per color`,
  );
});

comp.add(scene);

export default comp;
