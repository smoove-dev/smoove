import { Circle, Composition, Easing, interpolate, Line, Rect, Sequence, Text } from "@smoove/core";

/**
 * Every dot makes the same left-to-right trip over the same frames. The only
 * thing that changes per row is the easing curve passed to interpolate, so the
 * dots pull apart and you can read each curve by how it speeds up, overshoots, or
 * settles.
 */
const width = 1280;
const height = 720;
const duration = 240;
const moveEnd = 150;

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "easing-compare",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const bg = new Sequence();
bg.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const trackLeft = 400;
const trackRight = 1080;

const curves = [
  { label: "linear", ease: undefined, fill: "#7d8590" },
  { label: "inOut(cubic)", ease: Easing.inOut(Easing.cubic), fill: "#4ea1ff" },
  { label: "out(back())", ease: Easing.out(Easing.back()), fill: "#ffd166" },
  { label: "elastic()", ease: Easing.elastic(), fill: "#39c6c0" },
  { label: "bounce", ease: Easing.bounce, fill: "#f78166" },
];

const dots = curves.map((curve, i) => {
  const y = 160 + i * 100;
  bg.add(new Line({ points: [trackLeft, y, trackRight, y], stroke: "#1f2933", strokeWidth: 3 }));
  bg.add(
    new Text({
      x: 60,
      y: y - 14,
      width: 310,
      text: curve.label,
      fontSize: 24,
      fontFamily: mono,
      fill: "#7d8590",
    }),
  );
  const dot = new Circle({ x: trackLeft, y, radius: 20, fill: curve.fill });
  bg.add(dot);
  return dot;
});

bg.register((frame) => {
  curves.forEach((curve, i) => {
    dots[i]?.x(
      interpolate(frame, [0, moveEnd], [trackLeft, trackRight], {
        easing: curve.ease,
        extrapolateRight: "clamp",
      }),
    );
  });
});

comp.add(bg);
export default comp;
