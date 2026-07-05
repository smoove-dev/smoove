import { Block, Composition, Image, Sequence, Text } from "@smoove/core";
import {
  BlurEffect,
  ColorKeyEffect,
  GlowEffect,
  HeatmapEffect,
  MeshGradient,
  NoiseGrainEffect,
  Waves,
} from "@smoove/effects";

const width = 1280;
const height = 720;
const comp = new Composition({
  id: "effects-showcase",
  fps: 30,
  durationInFrames: 240,
  width,
  height,
  loop: true,
});

// Scene 1 (0–120): MeshGradient background + heatmap'd image + glowing title.
const scene1 = new Sequence({ from: 0, durationInFrames: 120 });

const bg = new MeshGradient({
  width,
  height,
  colors: ["#0b1020", "#1d4ed8", "#9333ea"],
  speed: 0.6,
});
scene1.add(bg);

const heatmap = new HeatmapEffect({ contour: 12, direction: 0.4 });
const blur = new BlurEffect({ radius: 0 });
const photo = new Image({
  src: `https://picsum.photos/seed/smoove-effects/400/400`,
  x: 440,
  y: 140,
  width: 400,
  height: 400,
  cornerRadius: 24,
  effects: [heatmap, blur],
});
scene1.add(photo);

const title = new Text({
  x: 0,
  y: 580,
  width,
  text: "shader effects",
  fontSize: 64,
  align: "center",
  fill: "#ffffff",
  effects: [new GlowEffect({ color: "#66ccff", radius: 24, intensity: 1.2 })],
});
scene1.add(title);

scene1.register((f) => {
  heatmap.enable(f < 100);
  heatmap.offset(f / 120);
  blur.radius(f > 90 ? (f - 90) * 2 : 0);
});

// Scene 2 (120–240): chroma key over a Waves background + layer-wide grain.
const scene2 = new Sequence({
  from: 120,
  durationInFrames: 120,
  effects: [new NoiseGrainEffect({ amount: 0.15 })],
});

const waves = new Waves({
  width,
  height,
  colorFront: "#ffbb00",
  colorBack: "#1a1030",
  shape: 1,
  frequency: 0.4,
  amplitude: 0.6,
  spacing: 1.1,
});
scene2.add(waves);

// A green card with white text: colorKey removes the green, so only the
// glyphs survive — a chroma key with no external footage needed.
const keyed = new Block({
  x: 240,
  y: 210,
  width: 800,
  height: 300,
  background: "#00ff00",
  justifyContent: "center",
  alignItems: "center",
  effects: [new ColorKeyEffect({ color: "#00ff00", similarity: 0.3 })],
});
keyed.add(
  new Text({
    text: "keyed out",
    fontSize: 96,
    fill: "#ffffff",
    width: 800,
    height: 120,
    align: "center",
  }),
);
scene2.add(keyed);

comp.add(scene1);
comp.add(scene2);

export default comp;
