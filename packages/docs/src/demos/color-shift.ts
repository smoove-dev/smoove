import { Composition, interpolateColors, Rect, Sequence, Text } from "@smoove/core";

/**
 * interpolateColors walks a value across a list of colors and returns an rgba
 * string. The panel's fill travels through four stops as the frame advances, and
 * the caption prints the exact rgba the engine hands back each tick.
 */
const width = 1280;
const height = 720;
const duration = 300;

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "color-shift",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const bg = new Sequence();
bg.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const panel = new Rect({
  x: 340,
  y: 170,
  width: 600,
  height: 320,
  cornerRadius: 28,
  fill: "#4ea1ff",
});
bg.add(panel);

bg.add(
  new Text({
    x: 0,
    y: 90,
    width,
    align: "center",
    text: "interpolateColors(frame, stops, colors)",
    fontSize: 26,
    fontFamily: mono,
    fill: "#7d8590",
  }),
);

const caption = new Text({
  x: 0,
  y: 540,
  width,
  align: "center",
  text: "",
  fontSize: 32,
  fontFamily: mono,
  fill: "#e6edf3",
});
bg.add(caption);

// First and last stop share a color so the loop has no seam.
const stops = [0, 100, 200, duration - 1];
const colors = ["#4ea1ff", "#ffd166", "#39c6c0", "#4ea1ff"];

bg.register((frame) => {
  const fill = interpolateColors(frame, stops, colors);
  panel.fill(fill);
  caption.setText(fill);
});

comp.add(bg);
export default comp;
