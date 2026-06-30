import { Composition, Rect, Sequence, Text, interpolate } from "@smoove/core";

/**
 * One sequence, eight bars, the same rise-and-fall tween offset by a per-index
 * delay. The wave is plain frame math: each bar reads interpolate(frame - i *
 * step, ...), so the stagger falls out of the frame number with no timers.
 */
const width = 1280;
const height = 720;
const duration = 240;

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "stagger",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const bg = new Sequence({ from: 0, durationInFrames: duration });
bg.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

bg.add(
  new Text({
    x: 0,
    y: 90,
    width,
    align: "center",
    text: "interpolate(frame - i * step, ...)",
    fontSize: 26,
    fontFamily: mono,
    fill: "#7d8590",
  }),
);

const count = 8;
const barW = 90;
const gap = 40;
const totalW = count * barW + (count - 1) * gap;
const startX = (width - totalW) / 2;
const baseline = 560;
const maxH = 320;

const step = 8; // frames of delay between adjacent bars
const rise = 40; // frames to grow
const hold = 60; // frames at full height
const localEnd = rise + hold + rise;

const bars = Array.from({ length: count }, (_, i) => {
  const x = startX + i * (barW + gap);
  const rect = new Rect({
    x,
    y: baseline,
    width: barW,
    height: 0,
    cornerRadius: 12,
    fill: "#4ea1ff",
  });
  bg.add(rect);
  return rect;
});

bg.register((frame) => {
  bars.forEach((rect, i) => {
    const local = frame - i * step;
    const h = interpolate(local, [0, rise, rise + hold, localEnd], [0, maxH, maxH, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    rect.height(h);
    rect.y(baseline - h);
  });
});

comp.add(bg);
export default comp;
