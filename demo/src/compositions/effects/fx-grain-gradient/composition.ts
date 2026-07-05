import { type Composition, Sequence, Text } from "@smoove/core";
import { GrainGradient } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * SEVEN ROOMS — GrainGradient carries seven completely different procedural shapes
 * behind one grainy gradient. This demo walks through all of them, one room
 * per second, softness dipping on each cut so every arrival lands crisp and
 * then melts.
 */
const comp: Composition = makeComp("fx-grain-gradient");
const scene = new Sequence();

const grain = new GrainGradient({
  width: W,
  height: H,
  colors: ["#7300ff", "#eba8ff", "#00bfff", "#2a00ff"],
  colorBack: "#06031a",
  softness: 0.5,
  intensity: 0.5,
  noise: 0.3,
  shape: "wave",
  speed: 0.8,
});
scene.add(grain);

const roomNo = new Text({
  x: 60,
  y: H - 120,
  text: "01",
  fontSize: 64,
  fontStyle: "bold",
  fill: "#ffffff",
  opacity: 0.9,
});
scene.add(roomNo);
const roomName = new Text({
  x: 60,
  y: H - 52,
  text: "wave",
  fontSize: 24,
  fontFamily: "monospace",
  fill: "#cbb5ff",
  letterSpacing: 6,
});
scene.add(roomName);

const SHAPES = ["wave", "dots", "truchet", "corners", "ripple", "blob", "sphere"] as const;
const PER = Math.floor(DURATION / SHAPES.length);

scene.register((f) => {
  const t = f % DURATION;
  const idx = Math.min(SHAPES.length - 1, Math.floor(t / PER));
  grain.shape(SHAPES[idx] as (typeof SHAPES)[number]);
  // Each room arrives sharp and dissolves: softness ramps within the room.
  const local = (t % PER) / PER;
  grain.softness(0.15 + 0.6 * local);
  roomNo.setText(String(idx + 1).padStart(2, "0"));
  roomName.setText(SHAPES[idx] as string);
});

comp.add(scene);

export default comp;
