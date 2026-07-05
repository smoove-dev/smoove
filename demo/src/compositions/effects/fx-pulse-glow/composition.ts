import { Circle, type Composition, Rect, Sequence, Text } from "@smoove/core";
import { PulseGlowEffect } from "@smoove/effects";
import { H, makeComp, W } from "../_shared.js";

/**
 * PULSE GLOW — a broadcast studio wall. PulseGlowEffect breathes on its own
 * period, so the ON AIR sign, the tally dot and the REC counter all pulse at
 * different rates with zero register wiring — the whole scene has no
 * callback at all.
 */
const comp: Composition = makeComp("fx-pulse-glow");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#0e0b0b" }));
scene.add(
  new Rect({
    x: W / 2 - 380,
    y: 220,
    width: 760,
    height: 220,
    cornerRadius: 18,
    fill: "#171010",
    stroke: "#2a1c1c",
    strokeWidth: 2,
  }),
);

// The sign: a slow two-second breath, dipping deep between peaks.
scene.add(
  new Text({
    x: 0,
    y: 285,
    width: W,
    text: "ON AIR",
    fontSize: 96,
    fontStyle: "bold",
    align: "center",
    fill: "#ff5148",
    letterSpacing: 20,
    effects: [new PulseGlowEffect({ color: "#ff2015", radius: 36, intensity: 1.6, period: 2 })],
  }),
);

// The tally dot pulses almost twice as fast — a camera heartbeat.
scene.add(
  new Circle({
    x: W / 2 - 330,
    y: 330,
    radius: 14,
    fill: "#ff3b30",
    effects: [
      new PulseGlowEffect({ color: "#ff3b30", radius: 22, intensity: 2, depth: 0.9, period: 1.1 }),
    ],
  }),
);

// REC ticks on a third rhythm, cooler and quieter.
scene.add(
  new Text({
    x: 0,
    y: 520,
    width: W,
    text: "REC 00:08:00",
    fontSize: 34,
    align: "center",
    fill: "#9fb4c7",
    letterSpacing: 8,
    effects: [
      new PulseGlowEffect({ color: "#7dd3fc", radius: 16, intensity: 0.9, depth: 0.5, period: 4 }),
    ],
  }),
);

comp.add(scene);

export default comp;
