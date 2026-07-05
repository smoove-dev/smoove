import { type Composition, Easing, Image, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { VignetteEffect } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * NOIR — a title card from a film that doesn't exist. The photo drifts in a
 * slow Ken Burns move while VignetteEffect breathes with it, tightening the
 * frame as the title fades up. The vignette is the lighting department.
 */
const comp: Composition = makeComp("fx-vignette");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#000000" }));

const vignette = new VignetteEffect({ amount: 0.85, radius: 0.9, softness: 0.6, color: "#000000" });
const photo = new Image({
  src: "https://picsum.photos/seed/fx-noir/1480/880?grayscale",
  x: -100,
  y: -80,
  width: 1480,
  height: 880,
  effects: [vignette],
});
scene.add(photo);

const title = new Text({
  x: 0,
  y: 300,
  width: W,
  text: "N O I R",
  fontSize: 96,
  align: "center",
  fill: "#e8e2d5",
  letterSpacing: 30,
  opacity: 0,
});
scene.add(title);

const credit = new Text({
  x: 0,
  y: 430,
  width: W,
  text: "a vignette in one act",
  fontSize: 24,
  align: "center",
  fill: "#8f8878",
  letterSpacing: 6,
  opacity: 0,
});
scene.add(credit);

scene.register((f) => {
  const t = f % DURATION;
  // Ken Burns: slow diagonal drift, eased across the whole loop and back.
  const drift = interpolate(t, [0, DURATION / 2, DURATION], [0, 1, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  photo.x(-100 + drift * 60);
  photo.y(-80 + drift * 30);

  // The iris: wide open → tight spotlight as the title lands, then release.
  const iris = interpolate(t, [0, 150, 330, 480], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.cubic),
  });
  vignette.radius(0.95 - 0.45 * iris);
  vignette.amount(0.6 + 0.35 * iris);
  vignette.softness(0.6 - 0.25 * iris);

  title.opacity(interpolate(t, [140, 200, 400, 460], [0, 1, 1, 0]));
  credit.opacity(interpolate(t, [180, 240, 400, 450], [0, 1, 1, 0]));
});

comp.add(scene);

export default comp;
