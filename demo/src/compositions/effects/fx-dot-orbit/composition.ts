import { type Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import { DotOrbit } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * FLOOR IS OPEN — a club floor at 124 BPM. DotOrbit's dots are the dancers:
 * spreading kicks on every bar, dot size pumps with the beat, and the
 * marquee only lights while the floor is loose.
 */
const comp: Composition = makeComp("fx-dot-orbit");
const scene = new Sequence();

const floor = new DotOrbit({
  width: W,
  height: H,
  colors: ["#ffc96b", "#ff6200", "#ff2f00", "#8a2be2", "#00e5ff"],
  colorBack: "#0a0410",
  dotSize: 0.6,
  sizeRange: 0.3,
  spreading: 0.2,
  stepsPerColor: 3,
  speed: 1.4,
});
scene.add(floor);

const marquee = new Text({
  x: 0,
  y: 300,
  width: W,
  text: "FLOOR IS OPEN",
  fontSize: 84,
  fontStyle: "bold",
  align: "center",
  fill: "#fff3e0",
  letterSpacing: 10,
  opacity: 0,
});
scene.add(marquee);

const bpm = new Text({
  x: 0,
  y: H - 80,
  width: W,
  text: "124 BPM",
  fontSize: 24,
  fontFamily: "monospace",
  align: "center",
  fill: "#ff9d5c",
  letterSpacing: 8,
});
scene.add(bpm);

const BEAT = 29; // ≈124 BPM at 60fps

scene.register((f) => {
  const t = f % DURATION;
  // Kick: size pumps on the beat with a fast decay.
  const inBeat = (f % BEAT) / BEAT;
  const kick = interpolate(inBeat, [0, 0.12, 1], [1, 0, 0], { easing: Easing.out(Easing.quad) });
  floor.dotSize(0.55 + 0.35 * kick);
  // The floor loosens over the first half (dots spread out), tightens to loop.
  floor.spreading(
    interpolate(t, [0, 200, 400, DURATION], [0.15, 1, 1, 0.15], {
      easing: Easing.inOut(Easing.quad),
    }),
  );
  marquee.opacity(interpolate(t, [60, 130, 420, 470], [0, 1, 1, 0]));
  bpm.opacity(0.5 + 0.5 * kick);
});

comp.add(scene);

export default comp;
