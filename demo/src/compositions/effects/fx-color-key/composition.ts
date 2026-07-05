import {
  Block,
  Circle,
  type Composition,
  Easing,
  interpolate,
  Rect,
  Sequence,
  Text,
} from "@smoove/core";
import { ColorKeyEffect, MeshGradient } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * ON AIR — a broadcast studio. The talent stands in front of a green screen;
 * when the key engages you watch ColorKeyEffect dissolve the green in real
 * time, dropping the "studio" into a virtual set. Similarity is the dial the
 * vision mixer is turning.
 */
const comp: Composition = makeComp("fx-color-key");
const scene = new Sequence();

// The virtual set revealed behind the key.
scene.add(
  new MeshGradient({
    width: W,
    height: H,
    colors: ["#0b1026", "#173a8a", "#5a2ea6", "#0b1026"],
    speed: 0.4,
  }),
);
scene.add(
  new Text({
    x: 0,
    y: 560,
    width: W,
    text: "VIRTUAL SET · CAM 2",
    fontSize: 24,
    align: "center",
    fill: "#9db1ff",
    letterSpacing: 8,
  }),
);

// The studio feed: an unevenly lit green screen (like the real thing), keyed
// as one node. The lighting gradient is what makes the key melt gradually —
// similarity swallows greens by chroma distance from the key color.
const key = new ColorKeyEffect({ color: "#25c95f", similarity: 0, smoothness: 0.06, spill: 0.25 });
const feed = new Block({
  x: 0,
  y: 0,
  width: W,
  height: H,
  background: {
    gradient: {
      type: "linear",
      angle: 90,
      stops: [
        [0, "#0f7a34"],
        [0.5, "#25c95f"],
        [1, "#0a6328"],
      ],
    },
  },
  effects: [key],
});
// Silhouette: head + shoulders, bottom middle — survives the key.
const head = new Circle({ x: W / 2, y: H - 220, radius: 90, fill: "#141a24" });
const body = new Rect({
  x: W / 2 - 170,
  y: H - 150,
  width: 340,
  height: 150,
  cornerRadius: [90, 90, 0, 0],
  fill: "#141a24",
});
scene.add(feed);
scene.add(body);
scene.add(head);

// Broadcast chrome above everything.
const badge = new Block({
  x: 48,
  y: 40,
  width: 170,
  height: 56,
  background: "#c81e3a",
  cornerRadius: 28,
  justifyContent: "center",
  alignItems: "center",
});
badge.add(
  new Text({
    text: "● ON AIR",
    fontSize: 26,
    fill: "#ffffff",
    width: 140,
    height: 30,
    align: "center",
  }),
);
scene.add(badge);

const status = new Text({
  x: 0,
  y: 44,
  width: W - 48,
  align: "right",
  text: "KEY 0%",
  fontSize: 24,
  fontFamily: "monospace",
  fill: "#ffffff",
  letterSpacing: 3,
});
scene.add(status);

scene.register((f) => {
  const t = f % DURATION;
  // The mixer cuts the key in, pushes similarity up (greens melt from the
  // best-lit patch outward), holds the composite, then pulls it all back.
  key.enable(t > 40 && t < 465);
  const dial = interpolate(t, [40, 190, 360, 460], [0, 0.28, 0.28, 0], {
    easing: Easing.inOut(Easing.cubic),
  });
  key.similarity(dial);
  status.setText(t <= 40 || t >= 465 ? "KEY OFF" : `KEY ${Math.round((dial / 0.28) * 100)}%`);
  // The ON AIR lamp blinks steadily.
  badge.opacity(f % 60 < 40 ? 1 : 0.45);
});

comp.add(scene);

export default comp;
