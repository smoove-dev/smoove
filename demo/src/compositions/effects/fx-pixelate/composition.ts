import { type Composition, Easing, Image, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { PixelateEffect } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * DECLASSIFIED — an intelligence photo decrypts on screen. PixelateEffect
 * eases from a 90px mosaic down to a single pixel, a red stamp slams in,
 * and the file re-censors itself before the loop restarts.
 */
const comp: Composition = makeComp("fx-pixelate");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#101312" }));

const pixelate = new PixelateEffect({ size: 90 });
const photo = new Image({
  src: "https://picsum.photos/seed/fx-classified/900/560",
  x: 190,
  y: 60,
  width: 900,
  height: 560,
  cornerRadius: 8,
  effects: [pixelate],
});
scene.add(photo);

// Dossier chrome.
scene.add(
  new Text({
    x: 200,
    y: 24,
    text: "FILE  A-113   ///   EYES ONLY",
    fontSize: 20,
    fontFamily: "monospace",
    fill: "#79a08b",
    letterSpacing: 4,
  }),
);
const progress = new Text({
  x: 200,
  y: 648,
  text: "DECRYPTING 0%",
  fontSize: 20,
  fontFamily: "monospace",
  fill: "#79a08b",
  letterSpacing: 4,
});
scene.add(progress);

const stamp = new Text({
  x: 0,
  y: 300,
  width: W,
  text: "DECLASSIFIED",
  fontSize: 92,
  fontStyle: "bold",
  align: "center",
  fill: "#e5484d",
  letterSpacing: 8,
  opacity: 0,
  rotation: -8,
});
scene.add(stamp);

scene.register((f) => {
  const t = f % DURATION;
  // Decrypt over the first 300 frames, hold sharp, then re-censor at the end.
  const size = interpolate(t, [0, 300, 390, 430, DURATION], [90, 1, 1, 90, 90], {
    easing: Easing.inOut(Easing.cubic),
  });
  pixelate.size(size);

  const pct = Math.round(interpolate(t, [0, 300, DURATION], [0, 100, 100]));
  progress.setText(t < 390 ? `DECRYPTING ${pct}%` : t < 430 ? "RE-ENCRYPTING…" : "ARCHIVED");

  // The stamp slams in the moment the image is sharp.
  const slam = interpolate(t, [300, 312, 390, 410], [0, 1, 1, 0], {
    easing: Easing.out(Easing.exp),
  });
  stamp.opacity(slam);
  const s = interpolate(t, [300, 312], [2.2, 1], { easing: Easing.out(Easing.cubic) });
  stamp.scale({ x: s, y: s });
  stamp.offsetX(0);
});

comp.add(scene);

export default comp;
