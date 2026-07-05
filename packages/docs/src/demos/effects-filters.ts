import { Composition, Rect, Sequence, Text } from "@smoove/core";
import {
  BlurEffect,
  ChromaticAberrationEffect,
  GlowEffect,
  NoiseGrainEffect,
  PixelateEffect,
} from "@smoove/effects";

/**
 * Filter effects animate like any other attr: each effect instance exposes
 * Konva-style accessors generated from its param schema, and the sequence's
 * own `effects` runs a layer-wide grain post-pass over everything.
 */
const width = 1280;
const height = 720;
const fps = 30;
const duration = fps * 6;

const comp = new Composition({
  id: "effects-filters",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const scene = new Sequence({
  effects: [new NoiseGrainEffect({ amount: 0.08 })],
});
scene.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const glow = new GlowEffect({ color: "#66ccff", radius: 20, intensity: 1.1 });
scene.add(
  new Text({
    x: 0,
    y: 120,
    width,
    text: "glow",
    fontSize: 96,
    align: "center",
    fill: "#ffffff",
    effects: [glow],
  }),
);

const pixelate = new PixelateEffect({ size: 1 });
const card = new Rect({
  x: 240,
  y: 300,
  width: 340,
  height: 220,
  cornerRadius: 24,
  fill: "#e8590c",
  effects: [pixelate],
});
scene.add(card);

const blur = new BlurEffect({ radius: 0 });
const aberration = new ChromaticAberrationEffect({ amount: 0 });
const card2 = new Rect({
  x: 700,
  y: 300,
  width: 340,
  height: 220,
  cornerRadius: 24,
  fill: "#20c997",
  effects: [blur, aberration],
});
scene.add(card2);

scene.register((f) => {
  const t = f / duration;
  glow.intensity(0.6 + 0.6 * Math.sin(t * Math.PI * 4) ** 2);
  pixelate.size(1 + 24 * Math.abs(Math.sin(t * Math.PI * 2)));
  blur.radius(8 * Math.abs(Math.sin(t * Math.PI * 2 + Math.PI / 3)));
  aberration.amount(10 * Math.abs(Math.sin(t * Math.PI * 2)));
});

comp.add(scene);

export default comp;
