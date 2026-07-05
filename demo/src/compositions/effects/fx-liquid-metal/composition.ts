import { type Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { LiquidMetal } from "@smoove/effects";
import { DURATION, glyphCanvas, H, makeComp, W } from "../_shared.js";

/**
 * FOUNDRY — a monogram cast in chrome. LiquidMetal pours its stripes through
 * the glyph's Poisson edge field: the flow direction swings around the mark,
 * the stripes multiply while the metal is "molten", and the red/blue
 * dispersion flares at the pour.
 */
const comp: Composition = makeComp("fx-liquid-metal");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#101014" }));

const metal = new LiquidMetal({
  src: glyphCanvas("S"),
  x: (W - 620) / 2,
  y: 30,
  width: 620,
  height: 620,
  colorBack: "#101014",
  colorTint: "#ffffff",
  repetition: 2,
  softness: 0.1,
  shiftRed: 0.3,
  shiftBlue: 0.3,
  distortion: 0.07,
  contour: 0.4,
  angle: 70,
  speed: 0.7,
});
scene.add(metal);

scene.add(
  new Text({
    x: 0,
    y: H - 78,
    width: W,
    align: "center",
    text: "SMOOVE FOUNDRY · CAST Nº 001",
    fontSize: 22,
    fill: "#8f8f9c",
    letterSpacing: 8,
  }),
);

scene.register((f) => {
  const t = f % DURATION;
  // The pour: stripes densify and the dispersion flares, then the metal sets.
  const molten = interpolate(t, [0, 200, 360, DURATION], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  metal.repetition(2 + 3 * molten);
  metal.shiftRed(0.3 + 0.5 * molten);
  metal.shiftBlue(0.3 - 0.5 * molten);
  metal.distortion(0.07 + 0.18 * molten);
  // The light walks around the mark once per loop.
  metal.angle((70 + (t / DURATION) * 360) % 360);
});

comp.add(scene);

export default comp;
