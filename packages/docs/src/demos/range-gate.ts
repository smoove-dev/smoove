import { Composition, Line, Rect, Sequence, Text } from "@konva-motion/core";

/**
 * Three Sequences with different `from` / `durationInFrames`. Each card only
 * exists — is drawn, ticked, painted — while the playhead sits inside that
 * sequence's window. The timeline at the bottom shows the windows and the
 * moving playhead so the gating is visible.
 */
const width = 1280;
const height = 720;
const duration = 180;

const comp = new Composition({
  id: "range-gate",
  fps: 30,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

type Win = { from: number; len: number; color: string; name: string };
const windows: Win[] = [
  { from: 0, len: 70, color: "#4cc9f0", name: "A · from 0, 70f" },
  { from: 55, len: 70, color: "#b5179e", name: "B · from 55, 70f" },
  { from: 115, len: 65, color: "#80ffdb", name: "C · from 115, 65f" },
];

// One card per window, each in its own range-gated Sequence.
windows.forEach((w, i) => {
  const seq = new Sequence({ from: w.from, durationInFrames: w.len });
  const x = 160 + i * 340;
  seq.add(new Rect({ x, y: 180, width: 280, height: 200, fill: w.color, cornerRadius: 16 }));
  seq.add(
    new Text({
      x,
      y: 262,
      width: 280,
      align: "center",
      text: w.name,
      fontSize: 24,
      fontStyle: "600",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      fill: "#0d1117",
    }),
  );
  comp.add(seq);
});

// Always-on layer: background, timeline track, window bars, and the playhead.
const base = new Sequence({ from: 0, durationInFrames: duration });
base.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const tlLeft = 160;
const tlRight = width - 160;
const tlY = 560;
const tlW = tlRight - tlLeft;
const frameToX = (f: number) => tlLeft + (f / (duration - 1)) * tlW;

base.add(new Line({ points: [tlLeft, tlY, tlRight, tlY], stroke: "#1f2933", strokeWidth: 4 }));

const bars = windows.map((w) => {
  const bar = new Rect({
    x: frameToX(w.from),
    y: tlY - 18,
    width: frameToX(w.from + w.len) - frameToX(w.from),
    height: 36,
    fill: w.color,
    cornerRadius: 8,
    opacity: 0.25,
  });
  base.add(bar);
  return bar;
});

const playhead = new Line({
  points: [tlLeft, tlY - 40, tlLeft, tlY + 40],
  stroke: "#f9fafb",
  strokeWidth: 3,
});
base.add(playhead);

base.register((frame) => {
  const x = frameToX(frame);
  playhead.points([x, tlY - 40, x, tlY + 40]);
  // Light up each window bar only while the playhead is inside it.
  windows.forEach((w, i) => {
    const active = frame >= w.from && frame < w.from + w.len;
    bars[i]?.opacity(active ? 0.95 : 0.25);
  });
});

comp.add(base);
export default comp;
