import { Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";

/**
 * One measure() call, three anchors: the dashed rect is the line box, the blue
 * rect hugs the glyph ink, and the purple underline sweeps along the alphabetic
 * baseline. The box alone would miss the letterforms on every axis.
 */
const width = 1280;
const height = 720;

const comp = new Composition({
  id: "measure-ink",
  fps: 60,
  durationInFrames: 240,
  width,
  height,
  loop: true,
});

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const headline = new Text({
  x: 140,
  y: 210,
  width: 1000,
  text: "Anchor to the letterforms, not the box",
  fontSize: 72,
  fontStyle: "bold",
  fontFamily: "system-ui, sans-serif",
  fill: "#e6edf3",
  lineHeight: 1.3,
});
main.add(headline);

// system-ui needs no webfont load, so setup-time geometry is already final.
const lines = headline.measure().lines ?? [];

const inkOutlines = lines.map((l) => {
  const r = new Rect({
    x: l.ink.x - 4,
    y: l.ink.y - 4,
    width: l.ink.width + 8,
    height: l.ink.height + 8,
    stroke: "#1f6feb",
    strokeWidth: 2,
    cornerRadius: 6,
    opacity: 0,
  });
  main.add(r);
  return r;
});
const boxOutlines = lines.map((l) => {
  const r = new Rect({
    x: l.x,
    y: l.y,
    width: l.width,
    height: l.height,
    stroke: "#30363d",
    strokeWidth: 1.5,
    dash: [6, 6],
    opacity: 0,
  });
  main.add(r);
  return r;
});
const underlines = lines.map((l) => {
  const r = new Rect({
    x: l.ink.x,
    y: l.baseline + 8,
    width: 0,
    height: 5,
    cornerRadius: 2.5,
    fill: "#bc8cff",
  });
  main.add(r);
  return r;
});

const legend: [string, string][] = [
  ["#30363d", "line box"],
  ["#1f6feb", "ink"],
  ["#bc8cff", "baseline"],
];
legend.forEach(([color, name], i) => {
  const x = 140 + i * 220;
  main.add(new Rect({ x, y: 560, width: 26, height: 10, cornerRadius: 5, fill: color }));
  main.add(
    new Text({
      x: x + 38,
      y: 552,
      text: name,
      fontSize: 24,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fill: "#7d8590",
    }),
  );
});

comp.add(main);

main.register((frame) => {
  const fade = interpolate(frame, [10, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  for (const r of boxOutlines) r.opacity(fade * 0.9);
  for (const r of inkOutlines) r.opacity(fade);
  underlines.forEach((r, i) => {
    const start = 50 + i * 55;
    const line = lines[i];
    if (!line) return;
    const w = interpolate(frame, [start, start + 45], [0, line.ink.width], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    r.width(w);
  });
});

export default comp;
