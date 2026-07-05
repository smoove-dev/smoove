import { Block, type Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import { ColorPanels } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * PRISM CONF — a keynote title slide. ColorPanels spins its translucent
 * blades behind the lockup; the camera angles swing on a slow pendulum and
 * the panels stretch as the date card lands. Glass, but animated.
 */
const comp: Composition = makeComp("fx-color-panels");
const scene = new Sequence();

const panels = new ColorPanels({
  width: W,
  height: H,
  colors: ["#ff9d00", "#fd4f30", "#809bff", "#6d2eff", "#333aff", "#f15cff"],
  colorBack: "#07060e",
  angle1: 0,
  angle2: 0,
  panelLength: 1.1,
  fadeIn: 1,
  fadeOut: 0.3,
  blur: 0.05,
  density: 3,
  speed: 0.4,
});
scene.add(panels);

const lockup = new Block({
  x: 0,
  y: 240,
  width: W,
  height: 240,
  justifyContent: "center",
  alignItems: "center",
  flexDirection: "column",
  gap: 16,
});
lockup.add(
  new Text({
    text: "PRISM CONF",
    fontSize: 96,
    fontStyle: "bold",
    fill: "#ffffff",
    letterSpacing: 12,
    width: W,
    height: 110,
    align: "center",
  }),
);
lockup.add(
  new Text({
    text: "light · color · motion — June 12–14",
    fontSize: 28,
    fill: "#cfd3e8",
    letterSpacing: 4,
    width: W,
    height: 36,
    align: "center",
  }),
);
scene.add(lockup);

scene.register((f) => {
  const t = f % DURATION;
  const p = (t / DURATION) * Math.PI * 2;
  // The blades pendulum on two axes, slightly out of phase.
  panels.angle1(0.5 * Math.sin(p));
  panels.angle2(0.35 * Math.sin(p * 2 + 1));
  // Panels stretch out as the lockup fades up, and retract to loop.
  panels.panelLength(
    interpolate(t, [0, 200, 420, DURATION], [0.7, 1.4, 1.4, 0.7], {
      easing: Easing.inOut(Easing.quad),
    }),
  );
  lockup.opacity(interpolate(t, [30, 100, 430, 475], [0, 1, 1, 0]));
});

comp.add(scene);

export default comp;
