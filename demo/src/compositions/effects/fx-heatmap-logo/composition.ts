import { type Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { Heatmap } from "@smoove/effects";
import { DURATION, glyphCanvas, H, makeComp, W } from "../_shared.js";

/**
 * AFTERBURN — a mark heating to white. The paper-design Heatmap runs its
 * iron ramp through the glyph's multi-scale blur field: the interior ignites
 * (inner glow), the heat bleeds outward (outer glow), and the shimmer
 * direction slowly swings as it cools back to embers.
 */
const comp: Composition = makeComp("fx-heatmap-logo");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#000000" }));

const heat = new Heatmap({
  src: glyphCanvas("S", "#111111"),
  x: (W - 620) / 2,
  y: 30,
  width: 620,
  height: 620,
  colors: ["#11206a", "#1f3ba2", "#2f63e7", "#6bd7ff", "#ffe679", "#ff991e", "#ff4c00"],
  colorBack: "#000000",
  contour: 0.5,
  angle: 0,
  noise: 0.05,
  innerGlow: 0.2,
  outerGlow: 0.2,
  speed: 0.8,
});
scene.add(heat);

const temp = new Text({
  x: 0,
  y: H - 78,
  width: W,
  align: "center",
  text: "THERMAL SIGNATURE · 300K",
  fontSize: 22,
  fontFamily: "monospace",
  fill: "#8090c8",
  letterSpacing: 6,
});
scene.add(temp);

scene.register((f) => {
  const t = f % DURATION;
  // Ignition: the glyph heats to white-hot, holds, and cools to embers.
  const heatUp = interpolate(t, [30, 220, 340, 460], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  heat.innerGlow(0.12 + 0.42 * heatUp);
  heat.outerGlow(0.1 + 0.32 * heatUp);
  heat.contour(0.35 + 0.35 * heatUp);
  heat.angle((t / DURATION) * 90);
  temp.setText(`THERMAL SIGNATURE · ${Math.round(300 + 900 * heatUp)}K`);
});

comp.add(scene);

export default comp;
