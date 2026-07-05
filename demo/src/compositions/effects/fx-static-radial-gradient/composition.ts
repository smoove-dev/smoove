import { Circle, type Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import { StaticRadialGradient } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * ECLIPSE — totality in eight seconds. StaticRadialGradient is the corona:
 * its focal point orbits a full 360° per loop (focalAngle is animatable even
 * though the gradient itself is a still), the falloff tightens at totality,
 * and a black disc plays the moon.
 */
const comp: Composition = makeComp("fx-static-radial-gradient");
const scene = new Sequence();

const corona = new StaticRadialGradient({
  width: W,
  height: H,
  colors: ["#fff3d6", "#ffb45e", "#5c2e91"],
  colorBack: "#050208",
  radius: 0.9,
  focalDistance: 0.8,
  focalAngle: 0,
  falloff: 0.3,
  mixing: 0.5,
  distortion: 0.15,
  distortionShift: 0,
  distortionFreq: 12,
  grainMixer: 0.1,
  grainOverlay: 0.06,
});
scene.add(corona);

const moon = new Circle({ x: W / 2, y: H / 2, radius: 150, fill: "#050208" });
scene.add(moon);

const title = new Text({
  x: 0,
  y: H - 100,
  width: W,
  align: "center",
  text: "E C L I P S E",
  fontSize: 40,
  fill: "#ffe9c9",
  letterSpacing: 28,
  opacity: 0.85,
});
scene.add(title);

scene.register((f) => {
  const t = f % DURATION;
  // The light orbits behind the moon — one full revolution per loop.
  corona.focalAngle((t / DURATION) * 360);
  // Totality mid-loop: the light source hides dead-center, corona tightens.
  const totality = interpolate(t, [140, 240, 260, 360], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  corona.focalDistance(0.8 - 0.75 * totality);
  corona.falloff(0.3 - 0.45 * totality);
  corona.distortionShift(0.4 * totality);
  title.opacity(0.5 + 0.5 * totality);
});

comp.add(scene);

export default comp;
