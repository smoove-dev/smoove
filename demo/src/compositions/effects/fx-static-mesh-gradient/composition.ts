import { type Composition, interpolate, Sequence, Text } from "@smoove/core";
import { StaticMeshGradient } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * STILL LIFE — a gallery of one painting, rehung six times. StaticMeshGradient
 * is a *still*: no clock drives it. Its `positions` seed recomposes the whole
 * canvas, so the demo steps through six numbered arrangements, each fading in
 * like the next plate in a catalogue.
 */
const comp: Composition = makeComp("fx-static-mesh-gradient");
const scene = new Sequence();

const still = new StaticMeshGradient({
  width: W,
  height: H,
  colors: ["#ffad0a", "#6200ff", "#e2a3ff", "#ff99fd"],
  positions: 1,
  waveX: 1,
  waveXShift: 0.6,
  waveY: 1,
  waveYShift: 0.21,
  mixing: 0.93,
  grainMixer: 0.15,
  grainOverlay: 0.08,
});
scene.add(still);

const plate = new Text({
  x: 0,
  y: H - 130,
  width: W - 64,
  align: "right",
  text: "Nº 1",
  fontSize: 72,
  fill: "#ffffff",
  opacity: 0.95,
});
scene.add(plate);
scene.add(
  new Text({
    x: 0,
    y: H - 52,
    width: W - 66,
    align: "right",
    text: "still life — mesh, rehung",
    fontSize: 22,
    fontFamily: "monospace",
    fill: "#f5e8ff",
    letterSpacing: 3,
    opacity: 0.7,
  }),
);

const PLATES = 6;
const PER = Math.floor(DURATION / PLATES);

scene.register((f) => {
  const t = f % DURATION;
  const idx = Math.min(PLATES - 1, Math.floor(t / PER));
  // A new arrangement per plate: the seed IS the composition.
  still.positions(1 + idx * 5);
  plate.setText(`Nº ${idx + 1}`);
  // Each plate fades up from black like a slide projector.
  const local = (t % PER) / PER;
  still.opacity(interpolate(local, [0, 0.18, 0.92, 1], [0, 1, 1, 0]));
});

comp.add(scene);

export default comp;
