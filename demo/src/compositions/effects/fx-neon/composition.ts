import { type Composition, Rect, Sequence, Text } from "@smoove/core";
import { NeonEffect } from "@smoove/effects";
import { H, makeComp, phase, W } from "../_shared.js";

/**
 * NEON TUBES — an arcade attract screen. NeonEffect carries the whole look:
 * hot white cores inside cyan and magenta tubes, and the coin line runs its
 * built-in deterministic flicker like a tube about to give up. The classic
 * arcade blink on INSERT COIN is the only register wiring.
 */
const comp: Composition = makeComp("fx-neon");
const scene = new Sequence();

// CRT-dark backdrop with scanline bands.
scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#05060c" }));
for (let i = 0; i < 24; i++) {
  scene.add(new Rect({ x: 0, y: i * 30, width: W, height: 1, fill: "#0a0d1a", opacity: 0.8 }));
}

const cyan = new NeonEffect({ color: "#22d3ee", radius: 34, intensity: 1.3, core: 0.8 });
scene.add(
  new Text({
    x: 0,
    y: 180,
    width: W,
    text: "HIGH SCORE",
    fontSize: 110,
    fontStyle: "bold",
    align: "center",
    fill: "#0e7490",
    letterSpacing: 10,
    effects: [cyan],
  }),
);

// The coin line flickers on the effect's own clock — no wiring needed.
const magenta = new NeonEffect({ color: "#f0f", radius: 24, intensity: 1.4, flicker: 0.65 });
const coin = new Text({
  x: 0,
  y: 460,
  width: W,
  text: "INSERT COIN",
  fontSize: 52,
  align: "center",
  fill: "#c026d3",
  letterSpacing: 16,
  effects: [magenta],
});
scene.add(coin);

scene.register((f) => {
  // Arcade blink: the coin line drops out for the last fifth of each second.
  coin.opacity(f % 60 < 48 ? 1 : 0.08);
  // The headline tube warms up and settles over the loop.
  cyan.intensity(1.3 + 0.15 * Math.sin(phase(f) * Math.PI * 2));
});

comp.add(scene);

export default comp;
