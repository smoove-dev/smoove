import { type Composition, Sequence, Text } from "@smoove/core";
import { PerlinNoise } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * OCTAVES — how detail is built. Perlin noise starts as one soft octave and
 * gains a layer every second: 1 → 8, each octave stacking finer structure
 * onto the same field. The counter is the whole lesson.
 */
const comp: Composition = makeComp("fx-perlin-noise");
const scene = new Sequence();

const noise = new PerlinNoise({
  width: W,
  height: H,
  colorBack: "#1c1436",
  colorFront: "#f5cff0",
  proportion: 0.42,
  softness: 0.35,
  octaveCount: 1,
  persistence: 0.62,
  lacunarity: 2.1,
  speed: 0.35,
});
scene.add(noise);

const counter = new Text({
  x: 60,
  y: H - 168,
  text: "1",
  fontSize: 110,
  fontStyle: "bold",
  fill: "#ffffff",
});
scene.add(counter);
scene.add(
  new Text({
    x: 64,
    y: H - 52,
    text: "octaves of perlin noise",
    fontSize: 24,
    fontFamily: "monospace",
    fill: "#b9a3e8",
    letterSpacing: 4,
  }),
);

// Tick marks: one per octave, lighting up as detail accumulates.
const ticks: Text[] = [];
for (let i = 0; i < 8; i++) {
  const tick = new Text({
    x: 0,
    y: 60 + i * 36,
    width: W - 60,
    align: "right",
    text: `${i + 1} ▪`,
    fontSize: 22,
    fontFamily: "monospace",
    fill: "#f5cff0",
    opacity: 0.15,
  });
  ticks.push(tick);
  scene.add(tick);
}

const PER = Math.floor(DURATION / 8);

scene.register((f) => {
  const t = f % DURATION;
  const octaves = Math.min(8, Math.floor(t / PER) + 1);
  noise.octaveCount(octaves);
  // Each new octave arrives slightly softer-edged, then crisps up.
  const local = (t % PER) / PER;
  noise.softness(0.5 - 0.3 * local);
  counter.setText(String(octaves));
  for (let i = 0; i < 8; i++) (ticks[i] as Text).opacity(i < octaves ? 0.95 : 0.15);
});

comp.add(scene);

export default comp;
