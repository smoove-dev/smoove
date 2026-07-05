import { type Composition, Easing, interpolate, Line, Sequence, Text } from "@smoove/core";
import { GodRays } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * DAWN — first light over a ridge. GodRays hangs above the horizon (the node
 * is oversized and shifted up so the rays pour down into frame), the sun's
 * core swells as it rises, and the mountains hold their silhouette.
 */
const comp: Composition = makeComp("fx-god-rays");
const scene = new Sequence();

// The sky: rays radiate from the node's center, so park that center high.
const sky = new GodRays({
  x: -W / 2,
  y: -H,
  width: W * 2,
  height: H * 2,
  colors: ["#ffd9a0e0", "#ff9d5cc0", "#fff3d8", "#ffb36b90"],
  colorBack: "#1a1030",
  colorBloom: "#ff8c42",
  density: 0.4,
  spotty: 0.25,
  midSize: 0.1,
  midIntensity: 0.2,
  intensity: 0.7,
  bloom: 0.5,
  speed: 0.35,
});
scene.add(sky);

// Ridgeline silhouettes (two layers for depth).
scene.add(
  new Line({
    points: [
      0,
      H,
      0,
      560,
      180,
      480,
      340,
      560,
      520,
      430,
      720,
      560,
      900,
      470,
      1090,
      570,
      W,
      500,
      W,
      H,
    ],
    fill: "#120b22",
    closed: true,
  }),
);
scene.add(
  new Line({
    points: [0, H, 0, 640, 240, 570, 470, 660, 700, 580, 950, 670, 1160, 610, W, 660, W, H],
    fill: "#0a0618",
    closed: true,
  }),
);

const title = new Text({
  x: 0,
  y: 590,
  width: W,
  text: "D A W N",
  fontSize: 54,
  align: "center",
  fill: "#ffe9c9",
  letterSpacing: 26,
  opacity: 0,
});
scene.add(title);

scene.register((f) => {
  const t = f % DURATION;
  // The sun rises: core swells, rays intensify, then it settles back.
  const rise = interpolate(t, [0, 260, 420, DURATION], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  sky.midSize(0.08 + 0.22 * rise);
  sky.midIntensity(0.15 + 0.5 * rise);
  sky.intensity(0.55 + 0.3 * rise);
  title.opacity(interpolate(t, [180, 260, 430, 475], [0, 1, 1, 0]));
});

comp.add(scene);

export default comp;
