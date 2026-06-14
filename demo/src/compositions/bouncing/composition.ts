import { Composition, Sequence } from "@konva-motion/core";
import Konva from "konva";

const width = 1280;
const height = 720;
const comp = new Composition({
  id: "bouncing",
  fps: 60,
  durationInFrames: 120,
  loop: true,
  width,
  height,
});

const main = new Sequence({ from: 0, durationInFrames: 120 });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const groundY = height - 60;
main.add(
  new Konva.Line({
    points: [40, groundY, width - 40, groundY],
    stroke: "#30363d",
    strokeWidth: 2,
  }),
);

const ball = new Konva.Circle({
  x: width / 2,
  y: 80,
  radius: 30,
  fill: "#ffd166",
  stroke: "#fff",
  strokeWidth: 2,
});
main.add(ball);
comp.add(main);

const minY = 80;
const maxY = groundY - 30;

main.register((frame) => {
  // Half a cycle each direction: down for 60 frames, up for 60.
  const t = frame / 60; // 0..2
  const phase = t % 2;
  const u = phase < 1 ? phase : 2 - phase; // triangle 0..1
  const eased = 1 - (1 - u) * (1 - u); // ease-out for the "fall"
  ball.y(minY + (maxY - minY) * eased);
  // squash near impact
  const squash = phase < 1 && u > 0.85 ? (u - 0.85) / 0.15 : 0;
  ball.scaleY(1 - squash * 0.3);
  ball.scaleX(1 + squash * 0.2);
});

export default comp;
