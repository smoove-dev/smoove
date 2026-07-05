import { type Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import { Metaballs } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * MITOSIS — life under the microscope. Metaballs' count param is the star:
 * one cell divides into fourteen and merges back, while ballSize breathes so
 * the culture never sits still. The readout counts the population.
 */
const comp: Composition = makeComp("fx-metaballs");
const scene = new Sequence();

const balls = new Metaballs({
  width: W,
  height: H,
  colors: ["#7ef0c1", "#3ecf8e", "#2bb673", "#c1f7dd"],
  colorBack: "#03140c",
  count: 1,
  ballSize: 0.95,
  speed: 0.6,
});
scene.add(balls);

const label = new Text({
  x: 48,
  y: H - 84,
  text: "SPECIMEN 07 — population 1",
  fontSize: 24,
  fontFamily: "monospace",
  fill: "#9df0c8",
  letterSpacing: 3,
});
scene.add(label);

scene.add(
  new Text({
    x: 0,
    y: 44,
    width: W - 48,
    align: "right",
    text: "MITOSIS ×400",
    fontSize: 24,
    fontFamily: "monospace",
    fill: "#9df0c8",
    letterSpacing: 3,
  }),
);

scene.register((f) => {
  const t = f % DURATION;
  // The culture grows 1 → 14 cells and collapses back to one.
  const population = interpolate(t, [0, 40, 300, 380, 470, DURATION], [1, 1, 14, 14, 1, 1], {
    easing: Easing.inOut(Easing.quad),
  });
  balls.count(population);
  // Cells shrink slightly as they multiply (conservation of goo).
  balls.ballSize(interpolate(population, [1, 14], [0.95, 0.62]));
  label.setText(`SPECIMEN 07 — population ${Math.round(population)}`);
});

comp.add(scene);

export default comp;
