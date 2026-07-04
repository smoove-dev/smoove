import {
  Arc,
  Composition,
  Easing,
  interpolate,
  Rect,
  RegularPolygon,
  Ring,
  Sequence,
  Star,
} from "@smoove/core";
import Konva from "konva";

/**
 * Shape geometry is just attributes, so it tweens like x or opacity. Each shape
 * below reads the current frame and drives one geometry attr: the Star pumps
 * its innerRadius, the Wedge-like Arc sweeps its angle, the RegularPolygon steps
 * through side counts, and the Ring opens its hole. Same register + interpolate
 * you already use for motion.
 */
const FONT = "ui-sans-serif, system-ui, sans-serif";
const MUTED = "#7d8590";

const width = 1280;
const height = 720;
const fps = 60;
const duration = fps * 3;

const comp = new Composition({
  id: "shape-morph",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

function label(text: string, x: number): Konva.Text {
  return new Konva.Text({
    x: x - 130,
    y: 470,
    width: 260,
    align: "center",
    text,
    fontSize: 16,
    fontFamily: FONT,
    fill: MUTED,
  });
}

const cy = 300;
const x0 = 220;
const x1 = 500;
const x2 = 780;
const x3 = 1060;

const star = new Star({
  x: x0,
  y: cy,
  numPoints: 5,
  innerRadius: 30,
  outerRadius: 80,
  fill: "#ff7b72",
});
const arc = new Arc({
  x: x1,
  y: cy,
  innerRadius: 36,
  outerRadius: 80,
  angle: 0,
  fill: "#388bfd",
});
const polygon = new RegularPolygon({ x: x2, y: cy, sides: 3, radius: 80, fill: "#3fb950" });
const ring = new Ring({ x: x3, y: cy, innerRadius: 10, outerRadius: 80, fill: "#bc8cff" });

main.add(star);
main.add(arc);
main.add(polygon);
main.add(ring);
main.add(label("Star.innerRadius()", x0));
main.add(label("Arc.angle()", x1));
main.add(label("RegularPolygon.sides()", x2));
main.add(label("Ring.innerRadius()", x3));

main.register((frame) => {
  // Star: pump the inner radius in and out.
  star.innerRadius(
    interpolate(frame, [0, duration / 2, duration], [12, 64, 12], {
      easing: Easing.inOut(Easing.cubic),
    }),
  );
  // Arc: sweep the angle from a sliver to a full ring.
  arc.angle(interpolate(frame, [0, duration - 1], [20, 350], { easing: Easing.inOut(Easing.sin) }));
  // RegularPolygon: step the side count 3 -> 8 (round to whole sides).
  polygon.sides(Math.round(interpolate(frame, [0, duration - 1], [3, 8])));
  // Ring: open the hole, then close it.
  ring.innerRadius(
    interpolate(frame, [0, duration / 2, duration], [8, 62, 8], {
      easing: Easing.inOut(Easing.cubic),
    }),
  );
});

comp.add(main);
export default comp;
