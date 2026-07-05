import { type Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { GemSmoke } from "@smoove/effects";
import { DURATION, glyphCanvas, H, makeComp, W } from "../_shared.js";

/**
 * INCENSE — a diamond mark exhaling. GemSmoke curls soft ink through and
 * around the glyph's edge field: the smoke rises (offset), swells past the
 * shape (outer glow + size), and settles back into the stone.
 */
const comp: Composition = makeComp("fx-gem-smoke");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#f0efea" }));

// Full-frame node: the smoke needs room to curl well past the mark.
const smoke = new GemSmoke({
  src: glyphCanvas("◆", "#111111"),
  x: (W - 680) / 2,
  y: 0,
  width: 680,
  height: 680,
  colors: ["#333333", "#e7e6df"],
  colorBack: "#f0efea",
  colorInner: "#fafaf5",
  outerGlow: 0.55,
  innerGlow: 1,
  innerDistortion: 0.8,
  outerDistortion: 0.6,
  offset: 0,
  angle: 0,
  smokeSize: 0.8,
  speed: 0.6,
});
scene.add(smoke);

scene.add(
  new Text({
    x: 0,
    y: H - 76,
    width: W,
    align: "center",
    text: "gem smoke — the mark exhales",
    fontSize: 22,
    fill: "#7a776c",
    letterSpacing: 6,
  }),
);

scene.register((f) => {
  const t = f % DURATION;
  // One long breath per loop.
  const breath = interpolate(t, [0, 240, 480], [0, 1, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  smoke.offset(-0.4 * breath); // smoke drifts upward
  smoke.outerGlow(0.35 + 0.5 * breath);
  smoke.smokeSize(0.65 + 0.3 * breath);
  smoke.outerDistortion(0.4 + 0.4 * breath);
});

comp.add(scene);

export default comp;
