import { type Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { ChromaticAberrationEffect } from "@smoove/effects";
import { H, hash01, makeComp, W } from "../_shared.js";

/**
 * SIGNAL LOST — a broadcast glitch. The RGB channels tear apart on every
 * beat, the split axis whips to a new angle, and slice bars flash across the
 * frame. ChromaticAberrationEffect carries the whole hit.
 */
const comp: Composition = makeComp("fx-chromatic-aberration");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#050507" }));

const ca = new ChromaticAberrationEffect({ amount: 0, angle: 0 });
const title = new Text({
  x: 0,
  y: 270,
  width: W,
  text: "SIGNAL",
  fontSize: 150,
  fontStyle: "bold",
  align: "center",
  fill: "#e9edf5",
  letterSpacing: 10,
  effects: [ca],
});
scene.add(title);

const caSub = new ChromaticAberrationEffect({ amount: 0, angle: 90 });
const sub = new Text({
  x: 0,
  y: 445,
  width: W,
  text: "— lost —",
  fontSize: 30,
  align: "center",
  fill: "#7d8496",
  letterSpacing: 8,
  effects: [caSub],
});
scene.add(sub);

// Glitch slice bars: thin rects that flash on beats only.
const slices: Rect[] = [];
for (let i = 0; i < 5; i++) {
  const bar = new Rect({
    x: 0,
    y: 0,
    width: W,
    height: 3 + i * 2,
    fill: i % 2 ? "#26ffe5" : "#ff2d78",
    opacity: 0,
  });
  slices.push(bar);
  scene.add(bar);
}

const BEAT = 60; // one hit per second

scene.register((f) => {
  const beat = Math.floor(f / BEAT);
  const tInBeat = (f % BEAT) / BEAT;
  // Sharp attack, long decay — the tear slams in and settles.
  const hit = interpolate(tInBeat, [0, 0.06, 1], [0, 1, 0], {
    easing: Easing.out(Easing.exp),
  });
  ca.amount(2 + 30 * hit);
  ca.angle((beat * 137) % 360); // whip to a new axis every beat
  caSub.amount(1 + 12 * hit);

  // Jitter the title horizontally only while the hit is hot.
  title.x(hit > 0.25 ? (hash01(f) - 0.5) * 26 * hit : 0);

  // Slice bars: deterministic positions per beat, visible during the attack.
  for (let i = 0; i < slices.length; i++) {
    const bar = slices[i] as Rect;
    bar.y(Math.floor(hash01(beat * 31 + i * 7) * H));
    bar.opacity(hit > 0.35 && hash01(beat * 13 + i) > 0.4 ? 0.55 * hit : 0);
  }
});

comp.add(scene);

export default comp;
