import { Circle, Composition, Line, Rect, Sequence, Text, interpolate } from "@smoove/core";

/**
 * Makes the frame → value mapping literal: a dot rides a track, and the readout
 * shows the exact frame and the `x` it interpolates to. The dot's position is
 * never stored: it is recomputed from `frame` every tick.
 */
const width = 1280;
const height = 720;
const duration = 240;

const comp = new Composition({
  id: "frame-clock",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: duration });
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const trackLeft = 200;
const trackRight = width - 200;
const trackY = 380;

main.add(
  new Line({ points: [trackLeft, trackY, trackRight, trackY], stroke: "#1f2933", strokeWidth: 4 }),
);

const dot = new Circle({ x: trackLeft, y: trackY, radius: 28, fill: "#ffd166" });
main.add(dot);

const readout = new Text({
  x: 0,
  y: 470,
  width,
  align: "center",
  text: "",
  fontSize: 34,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fill: "#e6edf3",
});
main.add(readout);

const formula = new Text({
  x: 0,
  y: 220,
  width,
  align: "center",
  text: "x = interpolate(frame, [0, 239], [200, 1080])",
  fontSize: 24,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fill: "#7d8590",
});
main.add(formula);

main.register((frame) => {
  const x = interpolate(frame, [0, duration - 1], [trackLeft, trackRight]);
  dot.x(x);
  readout.setText(`frame ${String(frame).padStart(3, " ")}   →   x = ${Math.round(x)}`);
});

comp.add(main);
export default comp;
