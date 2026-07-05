import { type Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { Waves } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * LP 002 — an album cover pressing itself. Waves fills the sleeve and morphs
 * through its whole shape vocabulary — zigzag → sine → irregular — while the
 * tracklist type sits beside it. Shape is a *continuous* dial, and hearing
 * it sweep is the whole point.
 */
const comp: Composition = makeComp("fx-waves");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#111014" }));

// The sleeve.
const SIZE = 520;
scene.add(
  new Rect({
    x: 120 - 10,
    y: (H - SIZE) / 2 - 10,
    width: SIZE + 20,
    height: SIZE + 20,
    fill: "#0a0a0c",
    shadowColor: "#000000",
    shadowBlur: 60,
    shadowOpacity: 0.8,
  }),
);
const cover = new Waves({
  x: 120,
  y: (H - SIZE) / 2,
  width: SIZE,
  height: SIZE,
  colorFront: "#f2b63d",
  colorBack: "#1c1030",
  shape: 0,
  frequency: 0.45,
  amplitude: 0.55,
  spacing: 1.1,
  proportion: 0.35,
  softness: 0.05,
});
scene.add(cover);

// The type column.
const tx = 720;
scene.add(
  new Text({
    x: tx,
    y: 150,
    text: "SINE &",
    fontSize: 76,
    fontStyle: "bold",
    fill: "#f5f1e6",
    letterSpacing: 2,
  }),
);
scene.add(
  new Text({
    x: tx,
    y: 240,
    text: "SAWTOOTH",
    fontSize: 76,
    fontStyle: "bold",
    fill: "#f2b63d",
    letterSpacing: 2,
  }),
);
scene.add(
  new Text({
    x: tx,
    y: 350,
    text: "LP 002 · 44.1 kHz · 33⅓ rpm",
    fontSize: 24,
    fill: "#8d8798",
    letterSpacing: 3,
  }),
);
const shapeLabel = new Text({
  x: tx,
  y: 420,
  text: "waveform: zigzag",
  fontSize: 24,
  fontFamily: "monospace",
  fill: "#5f5a6b",
  letterSpacing: 2,
});
scene.add(shapeLabel);

const NAMES = ["zigzag", "sine", "irregular", "broken"];

scene.register((f) => {
  const t = f % DURATION;
  // Sweep the shape dial 0 → 3 → 0 across the loop; amplitude breathes with it.
  const shape = interpolate(t, [0, DURATION / 2, DURATION], [0, 3, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  cover.shape(shape);
  cover.amplitude(0.45 + 0.2 * Math.sin((t / DURATION) * Math.PI * 2));
  shapeLabel.setText(`waveform: ${NAMES[Math.min(3, Math.round(shape))]}  (${shape.toFixed(2)})`);
});

comp.add(scene);

export default comp;
