import { Circle, type Composition, Rect, Sequence, Text } from "@smoove/core";
import { GlowEffect } from "@smoove/effects";
import { H, hash01, makeComp, W } from "../_shared.js";

/**
 * NEON — a sign on a night wall. GlowEffect is the tube: the pink script and
 * the cyan ring each carry their own glow, and a deterministic flicker cuts
 * the power now and then, exactly like a tired transformer.
 */
const comp: Composition = makeComp("fx-glow");
const scene = new Sequence();

// Night wall: near-black with faint brick bands.
scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#0a0a10" }));
for (let i = 0; i < 12; i++) {
  scene.add(
    new Rect({
      x: 0,
      y: i * 64,
      width: W,
      height: 1,
      fill: "#15151f",
    }),
  );
}

const pink = new GlowEffect({ color: "#ff4fa3", radius: 30, intensity: 1.6 });
const cyan = new GlowEffect({ color: "#37e5f0", radius: 26, intensity: 1.4 });

const ring = new Circle({
  x: W / 2,
  y: 300,
  radius: 170,
  stroke: "#b7fbff",
  strokeWidth: 6,
  effects: [cyan],
});
scene.add(ring);

const sign = new Text({
  x: 0,
  y: 250,
  width: W,
  text: "OPEN",
  fontSize: 104,
  fontStyle: "bold",
  align: "center",
  fill: "#ffd8ec",
  letterSpacing: 14,
  effects: [pink],
});
scene.add(sign);

const hours = new Text({
  x: 0,
  y: 540,
  width: W,
  text: "24 / 7",
  fontSize: 40,
  align: "center",
  fill: "#9ff5fb",
  letterSpacing: 18,
  effects: [cyan],
});
scene.add(hours);

scene.register((f) => {
  // Base breathing + occasional brown-outs. hash01 per 4-frame cell keeps the
  // flicker crisp but fully deterministic.
  const cell = Math.floor(f / 4);
  const flicker = hash01(cell);
  // The sign browns out hard twice per loop (a longer dropout window).
  const dropout = (f % 240 > 214 && f % 240 < 226 ? 0.15 : 1) * (flicker > 0.93 ? 0.35 : 1);
  const breathe = 1 + 0.12 * Math.sin((f / 60) * Math.PI);
  pink.intensity(1.7 * breathe * dropout);
  sign.opacity(0.75 + 0.25 * dropout);
  // The ring hums on its own cycle and survives the dropouts (separate tube).
  const ringFlicker = hash01(cell + 999) > 0.97 ? 0.4 : 1;
  cyan.intensity(1.4 * (1 + 0.1 * Math.sin((f / 45) * Math.PI)) * ringFlicker);
  ring.opacity(0.8 + 0.2 * ringFlicker);
});

comp.add(scene);

export default comp;
