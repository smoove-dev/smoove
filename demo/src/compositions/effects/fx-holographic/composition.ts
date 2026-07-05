import { type Composition, Rect, Sequence, Text } from "@smoove/core";
import { HolographicEffect } from "@smoove/effects";
import { H, makeComp, phase, W } from "../_shared.js";

/**
 * HOLOGRAPHIC — a trading-card foil. HolographicEffect drifts rainbow bands
 * across the card face and the title; the register callback rocks the sheen
 * angle back and forth like tilting the card under a lamp.
 */
const comp: Composition = makeComp("fx-holographic");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#0c0e13" }));

// The card: one foil instance shared by face and title, so they tilt as one.
const foil = new HolographicEffect({ intensity: 0.22, scale: 3.2, angle: 40 });
scene.add(
  new Rect({
    x: W / 2 - 260,
    y: 100,
    width: 520,
    height: 520,
    cornerRadius: 28,
    fill: "#232733",
    stroke: "#3d4356",
    strokeWidth: 3,
    effects: [foil],
  }),
);

const title = new HolographicEffect({ intensity: 0.85, scale: 4, angle: 40 });
scene.add(
  new Text({
    x: 0,
    y: 300,
    width: W,
    text: "ULTRA RARE",
    fontSize: 88,
    fontStyle: "bold",
    align: "center",
    fill: "#cfd6e6",
    letterSpacing: 6,
    effects: [title],
  }),
);

scene.add(
  new Text({
    x: 0,
    y: 560,
    width: W,
    text: "№ 001 / 100",
    fontSize: 30,
    align: "center",
    fill: "#6d7690",
    letterSpacing: 10,
  }),
);

scene.register((f) => {
  // Rock the card ±18° around the resting angle, one full sway per loop.
  const sway = 18 * Math.sin(phase(f) * Math.PI * 2);
  foil.angle(40 + sway);
  title.angle(40 + sway);
});

comp.add(scene);

export default comp;
