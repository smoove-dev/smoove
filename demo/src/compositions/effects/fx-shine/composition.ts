import { type Composition, Rect, Sequence, Text } from "@smoove/core";
import { ShineEffect } from "@smoove/effects";
import { H, makeComp, W } from "../_shared.js";

/**
 * SHINE — a premiere title card. ShineEffect is the gloss: a specular band
 * sweeps the gold title on the clock, a slower, softer band follows on the
 * credit line, and nothing here needs a register callback — the sweep is
 * the effect's own period.
 */
const comp: Composition = makeComp("fx-shine");
const scene = new Sequence();

// Velvet-dark stage with a faint floor bounce.
scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#0b0906" }));
scene.add(
  new Rect({
    x: 0,
    y: H - 180,
    width: W,
    height: 180,
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint: { x: 0, y: 180 },
    fillLinearGradientColorStops: [0, "#0b0906", 1, "#1a1408"],
  }),
);

// The 8s loop is exactly two 4s sweeps, so the loop point is invisible.
const gloss = new ShineEffect({ color: "#fff3c4", width: 0.1, angle: 70, period: 4 });
scene.add(
  new Text({
    x: 0,
    y: 250,
    width: W,
    text: "GOLDEN HOUR",
    fontSize: 120,
    fontStyle: "bold",
    align: "center",
    fill: "#d4a017",
    letterSpacing: 8,
    effects: [gloss],
  }),
);

// The credit line catches a wider, quieter reflection of the same light.
const soft = new ShineEffect({
  color: "#ffffff",
  width: 0.22,
  angle: 70,
  period: 4,
  intensity: 0.5,
});
scene.add(
  new Text({
    x: 0,
    y: 420,
    width: W,
    text: "A SMOOVE PICTURE",
    fontSize: 34,
    align: "center",
    fill: "#8a7648",
    letterSpacing: 14,
    effects: [soft],
  }),
);

comp.add(scene);

export default comp;
