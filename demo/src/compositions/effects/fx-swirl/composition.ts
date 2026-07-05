import { type Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import { Swirl } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * VERTIGO — a title sequence that pulls you down the stairwell. Swirl's
 * twist winds the bands tighter and tighter while bandCount doubles, and the
 * type holds dead-center like the one fixed point in the fall.
 */
const comp: Composition = makeComp("fx-swirl");
const scene = new Sequence();

const stairs = new Swirl({
  width: W,
  height: H,
  colors: ["#ffd1d1", "#ff8a8a", "#660000"],
  colorBack: "#1c0505",
  bandCount: 3,
  twist: 0.05,
  center: 0.2,
  proportion: 0.5,
  softness: 0.05,
  noise: 0.1,
  noiseFrequency: 0.4,
  speed: 0.28,
});
scene.add(stairs);

const title = new Text({
  x: 0,
  y: H / 2 - 40,
  width: W,
  align: "center",
  text: "VERTIGO",
  fontSize: 72,
  fontStyle: "bold",
  fill: "#fff5f0",
  letterSpacing: 20,
});
scene.add(title);

const depth = new Text({
  x: 0,
  y: H / 2 + 50,
  width: W,
  align: "center",
  text: "twist 0.05",
  fontSize: 20,
  fontFamily: "monospace",
  fill: "#ffb3a6",
  letterSpacing: 6,
  opacity: 0.8,
});
scene.add(depth);

scene.register((f) => {
  const t = f % DURATION;
  // The fall: twist winds up, bands multiply, then everything unwinds.
  const fall = interpolate(t, [0, 300, 400, DURATION], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.cubic),
  });
  const twist = 0.05 + 0.5 * fall;
  stairs.twist(twist);
  stairs.bandCount(Math.round(3 + 6 * fall));
  stairs.center(0.2 + 0.35 * fall);
  depth.setText(`twist ${twist.toFixed(2)} · ${Math.round(3 + 6 * fall)} bands`);
  // The title trembles ever so slightly at maximum depth.
  title.opacity(1 - 0.15 * fall * Math.abs(Math.sin(t / 6)));
});

comp.add(scene);

export default comp;
