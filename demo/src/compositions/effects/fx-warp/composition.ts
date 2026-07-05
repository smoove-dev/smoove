import { type Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import { Warp } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * SOIE — a fashion-house ident. Warp is the fabric: checks liquefy into
 * stripes and then into raw color edges as the swirl kneads the silk, one
 * pattern per act, with the wordmark sitting quietly on top.
 */
const comp: Composition = makeComp("fx-warp");
const scene = new Sequence();

const silk = new Warp({
  width: W,
  height: H,
  colors: ["#141216", "#b49bff", "#141216", "#e6c9ff"],
  proportion: 0.45,
  softness: 1,
  distortion: 0.2,
  swirl: 0.6,
  swirlIterations: 10,
  shapeScale: 0.12,
  shape: "checks",
  speed: 0.6,
});
scene.add(silk);

const mark = new Text({
  x: 0,
  y: H / 2 - 60,
  width: W,
  align: "center",
  text: "SOIE",
  fontSize: 120,
  fill: "#f8f5ff",
  letterSpacing: 44,
});
scene.add(mark);
const line = new Text({
  x: 0,
  y: H / 2 + 76,
  width: W,
  align: "center",
  text: "collection nº 02 — woven in shader",
  fontSize: 22,
  fill: "#cbb9e8",
  letterSpacing: 6,
  opacity: 0.85,
});
scene.add(line);

const ACTS = ["checks", "stripes", "edge"] as const;
const PER = Math.floor(DURATION / ACTS.length);

scene.register((f) => {
  const t = f % DURATION;
  const act = Math.min(ACTS.length - 1, Math.floor(t / PER));
  silk.shape(ACTS[act] as (typeof ACTS)[number]);
  // Within each act the fabric is kneaded: swirl and distortion rise and ease.
  const local = (t % PER) / PER;
  const knead = interpolate(local, [0, 0.5, 1], [0, 1, 0], { easing: Easing.inOut(Easing.quad) });
  silk.swirl(0.45 + 0.45 * knead);
  silk.distortion(0.12 + 0.25 * knead);
  mark.opacity(0.85 + 0.15 * knead);
});

comp.add(scene);

export default comp;
