import { type Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import { Voronoi } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * ROSE WINDOW — stained glass being leaded. Voronoi's cells are the panes:
 * the gap widens until black cames separate every piece, the glow lights the
 * glass from behind like afternoon sun, then the window melts back into one
 * molten sheet.
 */
const comp: Composition = makeComp("fx-voronoi");
const scene = new Sequence();

const glass = new Voronoi({
  width: W,
  height: H,
  colors: ["#ff8247", "#ffe53d", "#d94f8e"],
  colorGlow: "#fff6e0",
  colorGap: "#180b04",
  stepsPerColor: 3,
  distortion: 0.38,
  gap: 0,
  glow: 0,
  speed: 0.35,
});
scene.add(glass);

const title = new Text({
  x: 56,
  y: H - 108,
  text: "ROSE WINDOW",
  fontSize: 46,
  fontStyle: "bold",
  fill: "#fff6e0",
  letterSpacing: 8,
});
scene.add(title);
const stage = new Text({
  x: 58,
  y: H - 50,
  text: "molten",
  fontSize: 22,
  fontFamily: "monospace",
  fill: "#ffd9a8",
  letterSpacing: 4,
});
scene.add(stage);

scene.register((f) => {
  const t = f % DURATION;
  // Leading: gap 0 → 0.07 (cames appear), then the sun comes through (glow),
  // then everything re-melts for the loop.
  const leaded = interpolate(t, [40, 180, 380, 470], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.cubic),
  });
  const sun = interpolate(t, [180, 260, 330, 420], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  glass.gap(0.07 * leaded);
  glass.glow(0.75 * sun);
  glass.distortion(0.38 - 0.18 * leaded); // panes settle as they're fixed in place
  stage.setText(sun > 0.5 ? "sunlit" : leaded > 0.5 ? "leaded" : "molten");
});

comp.add(scene);

export default comp;
