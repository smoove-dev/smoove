import { Block, Composition, Rect, Sequence, Text, interpolate } from "@konva-motion/core";

/**
 * cornerRadius shapes: a sharp box, a uniformly rounded one, per-corner radii
 * (top corners only), and a pill (a radius past half the height rounds the ends
 * fully). Panels fade up on a small stagger.
 */
const width = 1280;
const height = 720;
const duration = 150;
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "block-corners",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const bg = new Sequence({ from: 0, durationInFrames: duration });
bg.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
comp.add(bg);

const content = new Sequence({ from: 0, durationInFrames: duration });

const panelW = 264;
const panelH = 200;
const gap = 32;
const startX = (width - (4 * panelW + 3 * gap)) / 2;
const baseY = 260;

const panels: { label: string; cornerRadius: number | number[] }[] = [
  { label: "0", cornerRadius: 0 },
  { label: "20", cornerRadius: 20 },
  { label: "[24,24,0,0]", cornerRadius: [24, 24, 0, 0] },
  { label: "pill", cornerRadius: 110 },
];

const blocks = panels.map((p, i) => {
  const panel = new Block({
    x: startX + i * (panelW + gap),
    y: baseY,
    width: panelW,
    height: panelH,
    justifyContent: "center",
    alignItems: "center",
    background: "#28344a",
    cornerRadius: p.cornerRadius,
  });
  panel.add(
    new Text({
      text: p.label,
      flexGrow: 1,
      align: "center",
      fontSize: 22,
      fontFamily: mono,
      fill: "#e6edf3",
    }),
  );
  content.add(panel);
  return panel;
});

content.register((frame) => {
  blocks.forEach((panel, i) => {
    const a = interpolate(frame, [i * 8, i * 8 + 22], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    panel.opacity(a);
    panel.y(baseY + (1 - a) * 16);
  });
});

comp.add(content);
export default comp;
