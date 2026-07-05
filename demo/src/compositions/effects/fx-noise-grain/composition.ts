import { Block, type Composition, Rect, Sequence, Text } from "@smoove/core";
import { NoiseGrainEffect } from "@smoove/effects";
import { H, hash01, makeComp, W } from "../_shared.js";

/**
 * SUPER 8 — a home-movie leader card run through a tired projector.
 * NoiseGrainEffect rides on the Sequence (a layer-wide post-pass), the frame
 * flickers and the gate weaves — every artifact frame-seeded, so the film
 * "damage" scrubs and renders identically every time.
 */
const comp: Composition = makeComp("fx-noise-grain");
const grain = new NoiseGrainEffect({ amount: 0.3, size: 2, animated: true });
const scene = new Sequence({ effects: [grain] });

// Warm leader-film base.
const base = new Rect({ x: 0, y: 0, width: W, height: H, fill: "#d9c9a3" });
scene.add(base);

// The card. Block so the gate weave can move one node.
const card = new Block({
  x: 240,
  y: 170,
  width: 800,
  height: 380,
  background: "#3b3125",
  cornerRadius: 6,
  justifyContent: "center",
  alignItems: "center",
  flexDirection: "column",
  gap: 18,
});
card.add(
  new Text({
    text: "SUPER 8",
    fontSize: 96,
    fontStyle: "bold",
    fill: "#e8dcbc",
    letterSpacing: 10,
    width: 700,
    height: 110,
    align: "center",
  }),
);
card.add(
  new Text({
    text: "· family reel — summer 1974 ·",
    fontSize: 26,
    fill: "#b3a382",
    letterSpacing: 4,
    width: 700,
    height: 36,
    align: "center",
  }),
);
scene.add(card);

// Projector flicker: a black veil whose opacity jumps per frame-cell.
const veil = new Rect({ x: 0, y: 0, width: W, height: H, fill: "#000000", opacity: 0 });
scene.add(veil);

// Sprocket-side exposure streak.
const streak = new Rect({ x: 0, y: 0, width: 26, height: H, fill: "#fff3d0", opacity: 0 });
scene.add(streak);

scene.register((f) => {
  // Grain breathes with the flicker — heavier when the lamp dips.
  const lamp = hash01(Math.floor(f / 2));
  veil.opacity(lamp > 0.82 ? 0.12 + 0.1 * lamp : 0.04 * Math.sin(f / 7) + 0.04);
  grain.amount(0.24 + (lamp > 0.82 ? 0.14 : 0.02 * Math.sin(f / 11)));

  // Gate weave: the whole card breathes ±2px on its own rhythm.
  card.x(240 + Math.round((hash01(Math.floor(f / 6)) - 0.5) * 4));
  card.y(170 + Math.round((hash01(Math.floor(f / 6) + 50) - 0.5) * 4));

  // A light-leak streak wanders through twice per loop.
  const leak = hash01(Math.floor(f / 120));
  streak.x(leak * W);
  streak.opacity(f % 120 < 18 ? 0.35 : 0);
});

comp.add(scene);

export default comp;
