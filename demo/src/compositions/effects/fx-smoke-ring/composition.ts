import { type Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { GlowEffect, SmokeRing } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * THE PORTAL — a ring of smoke holds a door open. The ring breathes wide to
 * let the word through, then closes to a filament. The invitation inside
 * carries a GlowEffect — sources and filters composing in one scene.
 */
const comp: Composition = makeComp("fx-smoke-ring");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#020617" }));

const ring = new SmokeRing({
  x: (W - H) / 2,
  y: 0,
  width: H,
  height: H,
  colors: ["#7dd3fc", "#e0f2fe", "#38bdf8"],
  colorBack: "#02061700",
  noiseScale: 2.6,
  noiseIterations: 8,
  radius: 0.2,
  thickness: 0.5,
  innerShape: 0.6,
  speed: 0.5,
});
scene.add(ring);

const glow = new GlowEffect({ color: "#7dd3fc", radius: 22, intensity: 1.1 });
const invite = new Text({
  x: 0,
  y: H / 2 - 30,
  width: W,
  align: "center",
  text: "ENTER",
  fontSize: 52,
  fontStyle: "bold",
  fill: "#f0f9ff",
  letterSpacing: 22,
  opacity: 0,
  effects: [glow],
});
scene.add(invite);

scene.register((f) => {
  const t = f % DURATION;
  // The portal opens (radius + thickness bloom), holds, then seals shut.
  const open = interpolate(t, [40, 180, 340, 460], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.cubic),
  });
  ring.radius(0.12 + 0.2 * open);
  ring.thickness(0.35 + 0.35 * open);
  ring.innerShape(0.9 - 0.5 * open); // hollows out as it opens
  invite.opacity(open);
  glow.intensity(0.6 + 0.9 * open);
});

comp.add(scene);

export default comp;
