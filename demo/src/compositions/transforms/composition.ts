import { Composition, Sequence } from "@konva-motion/core";
import Konva from "konva";

const width = 1280;
const height = 720;
const totalFrames = 240;
const comp = new Composition({
  id: "transforms",
  fps: 60,
  durationInFrames: totalFrames,
  loop: true,
  width,
  height,
});

const main = new Sequence({ from: 0, durationInFrames: totalFrames });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const cx = width / 2;
const cy = height / 2;

const shapes: Konva.RegularPolygon[] = [];
const sides = [3, 4, 5, 6];
sides.forEach((s, i) => {
  const shape = new Konva.RegularPolygon({
    x: cx,
    y: cy,
    sides: s,
    radius: 100,
    stroke: ["#ff6b6b", "#ffd166", "#06d6a0", "#4ea1ff"][i],
    strokeWidth: 3,
    fill: "transparent",
  });
  main.add(shape);
  shapes.push(shape);
});
comp.add(main);

main.register((frame) => {
  const t = frame / totalFrames; // 0..1
  const angle = t * Math.PI * 2;
  shapes.forEach((shape, i) => {
    shape.rotation((angle * (i + 1) * 30) % 360);
    const pulse = 1 + Math.sin(angle * (i + 1)) * 0.3;
    shape.scaleX(pulse);
    shape.scaleY(pulse);
  });
});

// Burst sequence: a center flash that appears briefly mid-loop.
const burst = new Sequence({ from: 100, durationInFrames: 40 });
const flash = new Konva.Circle({
  x: cx,
  y: cy,
  radius: 20,
  fill: "#fff",
});
burst.add(flash);
comp.add(burst);
burst.register((local) => {
  const u = local / 40;
  flash.radius(20 + u * 200);
  flash.opacity(1 - u);
});

export default comp;
