import { Circle, Composition, Line, Rect, Sequence, Text, interpolate } from "@smoove/core";

/**
 * interpolate turns the current frame into any number. Three rows show the same
 * idea at work: a plain two-stop map, a multi-stop map that holds in the middle,
 * and the gap between "clamp" and the default "extend" once the frame runs past
 * the input range.
 */
const width = 1280;
const height = 720;
const duration = 240;

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "interpolate-basics",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const bg = new Sequence({ from: 0, durationInFrames: duration });
bg.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const trackLeft = 380;
const trackRight = 1120;

const rows = [
  { y: 240, label: "two-stop" },
  { y: 400, label: "multi-stop hold" },
  { y: 560, label: "clamp vs extend" },
];

for (const row of rows) {
  bg.add(
    new Line({ points: [trackLeft, row.y, trackRight, row.y], stroke: "#1f2933", strokeWidth: 4 }),
  );
  bg.add(
    new Text({
      x: 60,
      y: row.y - 14,
      width: 300,
      text: row.label,
      fontSize: 24,
      fontFamily: mono,
      fill: "#7d8590",
    }),
  );
}

const dotSimple = new Circle({ x: trackLeft, y: 240, radius: 22, fill: "#4ea1ff" });
const dotHold = new Circle({ x: trackLeft, y: 400, radius: 22, fill: "#ffd166" });
const dotClamp = new Circle({ x: trackLeft, y: 560, radius: 22, fill: "#39c6c0" });
const dotExtend = new Circle({ x: trackLeft, y: 560, radius: 22, fill: "#f78166", opacity: 0.65 });
bg.add(dotSimple);
bg.add(dotHold);
bg.add(dotClamp);
bg.add(dotExtend);

const readout = new Text({
  x: 0,
  y: 110,
  width,
  align: "center",
  text: "",
  fontSize: 30,
  fontFamily: mono,
  fill: "#e6edf3",
});
bg.add(readout);

bg.register((frame) => {
  // (a) plain two-stop map: the whole frame range stretches onto the track.
  dotSimple.x(interpolate(frame, [0, duration - 1], [trackLeft, trackRight]));

  // (b) multi-stop: out to the right, hold, then back. Each pair of stops is its
  // own linear segment.
  dotHold.x(
    interpolate(frame, [0, 80, 160, duration - 1], [trackLeft, trackRight, trackRight, trackLeft]),
  );

  // (c) same input range [0, 120] for both dots, but the frame keeps climbing.
  // clamp freezes at the right edge; the default extend keeps extrapolating past
  // it and runs off the end.
  dotClamp.x(interpolate(frame, [0, 120], [trackLeft, trackRight], { extrapolateRight: "clamp" }));
  dotExtend.x(interpolate(frame, [0, 120], [trackLeft, trackRight]));

  readout.setText(`frame ${String(frame).padStart(3, " ")}`);
});

comp.add(bg);
export default comp;
