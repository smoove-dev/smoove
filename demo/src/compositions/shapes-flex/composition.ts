import {
  Circle,
  Composition,
  Easing,
  Flex,
  interpolate,
  Rect,
  RegularPolygon,
  Ring,
  Sequence,
  Star,
} from "@smoove/core";

const width = 1280;
const height = 720;
const duration = 150;

const comp = new Composition({
  id: "shapes-flex",
  fps: 30,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: duration });
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

// A centered flex row holding one of every shape family. Each keeps its
// intrinsic (getSelfRect) size; the engine positions them by bounding box, so
// the centered-origin shapes (Circle, Star, RegularPolygon, Ring) line up with
// the top-left-origin Rect instead of being offset by their radius.
const row = new Flex({
  x: 0,
  y: 0,
  width,
  height,
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  gap: 40,
});

const rect = new Rect({ width: 140, height: 140, fill: "#38bdf8", cornerRadius: 16 });
const circle = new Circle({ radius: 75, fill: "#f472b6" });
const star = new Star({ numPoints: 5, innerRadius: 45, outerRadius: 90, fill: "#facc15" });
const hexagon = new RegularPolygon({ sides: 6, radius: 80, fill: "#a78bfa" });
const ring = new Ring({ innerRadius: 35, outerRadius: 78, fill: "#34d399" });

for (const shape of [rect, circle, star, hexagon, ring]) row.add(shape);
main.add(row);

// Animation stays centralized in Sequence.register (no per-node ticking).
main.register((frame) => {
  const t = frame / duration;
  star.rotation(interpolate(t, [0, 1], [0, 360]));
  hexagon.rotation(interpolate(t, [0, 1], [0, -360]));
  const pulse = interpolate(Math.sin(t * Math.PI * 2), [-1, 1], [0.85, 1.15], {
    easing: Easing.inOut(Easing.quad),
  });
  circle.scale({ x: pulse, y: pulse });
});

comp.add(main);
export default comp;
