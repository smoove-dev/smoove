import { type Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import { Spiral } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * DEEPER — a hypnotist's wheel. The spiral turns forever (that's its clock);
 * what changes is the induction: strokes thicken, distortion wobbles in,
 * and the taper pulls the line into a vanishing point as the words descend.
 */
const comp: Composition = makeComp("fx-spiral");
const scene = new Sequence();

const wheel = new Spiral({
  width: W,
  height: H,
  colorBack: "#120c1e",
  colorFront: "#e7d7ff",
  density: 0.6,
  distortion: 0,
  lineWidth: 0.4,
  strokeTaper: 0,
  strokeCap: 0.5,
  softness: 0.1,
  speed: 0.8,
});
scene.add(wheel);

const word = new Text({
  x: 0,
  y: H / 2 - 26,
  width: W,
  align: "center",
  text: "relax",
  fontSize: 40,
  fill: "#ffffff",
  letterSpacing: 16,
  opacity: 0,
});
scene.add(word);

const WORDS = ["relax", "focus", "deeper", "sleep"];

scene.register((f) => {
  const t = f % DURATION;
  // The induction deepens across the loop and releases at the end.
  const depth = interpolate(t, [0, 380, 470, DURATION], [0, 1, 0, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  wheel.lineWidth(0.35 + 0.3 * depth);
  wheel.distortion(0.35 * depth * (0.5 + 0.5 * Math.sin((t / 40) * Math.PI)));
  wheel.strokeTaper(0.6 * depth);
  wheel.density(0.6 + 0.25 * depth);
  // One word per phase, breathing in and out of the center.
  const phaseLen = 110;
  const idx = Math.min(WORDS.length - 1, Math.floor(t / phaseLen));
  word.setText(WORDS[idx] as string);
  const local = (t % phaseLen) / phaseLen;
  word.opacity(interpolate(local, [0.1, 0.35, 0.75, 1], [0, 0.9, 0.9, 0]));
});

comp.add(scene);

export default comp;
