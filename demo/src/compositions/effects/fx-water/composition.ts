import { type Composition, Easing, Image, interpolate, Sequence, Text } from "@smoove/core";
import { WaterEffect } from "@smoove/effects";
import Konva from "konva";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * THE POOL — tiles seen through a meter of water. The whole floor (tiles,
 * lane line, painted depth marking) is one image, and WaterEffect refracts
 * it as a single surface: caustics sharpen when the sun comes out, a breeze
 * crosses mid-loop, and the typography wobbles the way pool paint always does.
 */
function poolFloor(): HTMLCanvasElement {
  const canvas = Konva.Util.createCanvasElement();
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = "#2e9cc3";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(31, 127, 160, 0.5)";
  for (let x = 0; x <= W; x += 80) ctx.fillRect(x, 0, 3, H);
  for (let y = 0; y <= H; y += 80) ctx.fillRect(0, y, W, 3);
  ctx.fillStyle = "rgba(18, 88, 111, 0.85)";
  ctx.fillRect(W / 2 - 24, 0, 48, H);
  ctx.fillStyle = "rgba(234, 247, 251, 0.92)";
  ctx.font = "bold 96px Helvetica, Arial, sans-serif";
  ctx.fillText("DEPTH 2.0m", 90, H / 2);
  return canvas;
}

const comp: Composition = makeComp("fx-water");
const scene = new Sequence();

const water = new WaterEffect({
  colorHighlight: "#ffffff",
  highlights: 0.05,
  layering: 0.5,
  edges: 0,
  waves: 0.15,
  caustic: 0.12,
  size: 1.4,
  speed: 0.8,
});

const floor = new Image({
  src: poolFloor() as unknown as HTMLImageElement,
  x: 0,
  y: 0,
  width: W,
  height: H,
  effects: [water],
});
scene.add(floor);

const caption = new Text({
  x: 0,
  y: H - 60,
  width: W - 40,
  align: "right",
  text: "WaterEffect — one filter over the whole floor",
  fontSize: 20,
  fill: "#dff4fa",
  letterSpacing: 3,
  opacity: 0.8,
});
scene.add(caption);

scene.register((f) => {
  const t = f % DURATION;
  // The sun comes out mid-loop: caustics sharpen and highlights bloom.
  const sun = interpolate(t, [60, 200, 340, 460], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  water.caustic(0.1 + 0.25 * sun);
  water.highlights(0.04 + 0.14 * sun);
  // A breeze crosses in the second half.
  const breeze = interpolate(t, [240, 330, 420, 480], [0, 1, 0, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  water.waves(0.12 + 0.35 * breeze);
});

comp.add(scene);

export default comp;
