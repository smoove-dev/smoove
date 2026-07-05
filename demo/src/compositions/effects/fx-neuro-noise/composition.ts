import { type Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { NeuroNoise } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * SYNAPSE — thoughts firing in the dark. NeuroNoise draws the glowing
 * threads; brightness pulses like action potentials and contrast deepens as
 * the network "concentrates". A slow scanline reads the activity out.
 */
const comp: Composition = makeComp("fx-neuro-noise");
const scene = new Sequence();

const net = new NeuroNoise({
  width: W,
  height: H,
  colorFront: "#ffffff",
  colorMid: "#47a6ff",
  colorBack: "#02040c",
  brightness: 0.05,
  contrast: 0.3,
  speed: 0.7,
});
scene.add(net);

const title = new Text({
  x: 0,
  y: 80,
  width: W,
  text: "S Y N A P S E",
  fontSize: 56,
  align: "center",
  fill: "#dceaff",
  letterSpacing: 24,
});
scene.add(title);

const readout = new Text({
  x: 0,
  y: H - 72,
  width: W,
  align: "center",
  text: "activity 0.05",
  fontSize: 22,
  fontFamily: "monospace",
  fill: "#6f9dd6",
  letterSpacing: 4,
});
scene.add(readout);

const scanline = new Rect({ x: 0, y: 0, width: W, height: 1, fill: "#9fd0ff", opacity: 0.25 });
scene.add(scanline);

scene.register((f) => {
  const t = f % DURATION;
  // Three thought-pulses per loop: brightness spikes then decays.
  const pulseT = (t % (DURATION / 3)) / (DURATION / 3);
  const pulse = interpolate(pulseT, [0, 0.1, 1], [0, 1, 0], { easing: Easing.out(Easing.cubic) });
  const brightness = 0.04 + 0.16 * pulse;
  net.brightness(brightness);
  // The network concentrates through the loop, then lets go.
  net.contrast(
    interpolate(t, [0, 240, 480], [0.25, 0.55, 0.25], { easing: Easing.inOut(Easing.quad) }),
  );
  readout.setText(`activity ${brightness.toFixed(2)}`);
  scanline.y((t / DURATION) * H);
  title.opacity(0.7 + 0.3 * pulse);
});

comp.add(scene);

export default comp;
