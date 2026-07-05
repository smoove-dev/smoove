import { Block, type Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import { MeshGradient } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * HERO — the landing page every gradient dreams of. MeshGradient is the
 * living backdrop: color spots drifting on the composition clock while the
 * headline, subline and CTA stage themselves in. Swirl tightens as the CTA
 * lands, like the page is leaning in.
 */
const comp: Composition = makeComp("fx-mesh-gradient");
const scene = new Sequence();

const mesh = new MeshGradient({
  width: W,
  height: H,
  colors: ["#0b1020", "#2743d6", "#8b2fd6", "#e04f9e"],
  distortion: 0.8,
  swirl: 0.1,
  speed: 0.45,
});
scene.add(mesh);

const headline = new Text({
  x: 120,
  y: 200,
  width: 900,
  text: "Make it move.",
  fontSize: 108,
  fontStyle: "bold",
  fill: "#ffffff",
  opacity: 0,
});
scene.add(headline);

const subline = new Text({
  x: 124,
  y: 340,
  width: 760,
  text: "Timeline-driven video for the canvas — shaders included.",
  fontSize: 30,
  fill: "#cdd6ff",
  lineHeight: 1.4,
  opacity: 0,
});
scene.add(subline);

const cta = new Block({
  x: 124,
  y: 440,
  width: 250,
  height: 66,
  background: "#ffffff",
  cornerRadius: 33,
  justifyContent: "center",
  alignItems: "center",
  opacity: 0,
});
cta.add(
  new Text({
    text: "npm create smoove",
    fontSize: 22,
    fill: "#101426",
    width: 220,
    height: 26,
    align: "center",
  }),
);
scene.add(cta);

scene.register((f) => {
  const t = f % DURATION;
  headline.opacity(
    interpolate(t, [20, 70, 430, 470], [0, 1, 1, 0], { easing: Easing.out(Easing.cubic) }),
  );
  subline.opacity(interpolate(t, [60, 110, 430, 470], [0, 1, 1, 0]));
  cta.opacity(interpolate(t, [110, 150, 430, 470], [0, 1, 1, 0]));
  // The gradient leans in behind the CTA: swirl + distortion tighten, then relax.
  const lean = interpolate(t, [110, 220, 380, 470], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  mesh.swirl(0.1 + 0.5 * lean);
  mesh.distortion(0.8 - 0.25 * lean);
});

comp.add(scene);

export default comp;
