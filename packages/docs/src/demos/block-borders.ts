import { Block, Composition, interpolate, Rect, Sequence, Text } from "@smoove/core";

/**
 * Borders on Block: a solid line, a dashed line, and a thicker stroke.
 * `borderStyle` is "solid" (default) or "dashed"; `borderSize` and
 * `borderColor` set the width and color. Panels fade up on a small stagger.
 */
const width = 1280;
const height = 720;
const duration = 150;
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "block-borders",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const bg = new Sequence();
bg.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
comp.add(bg);

const content = new Sequence();

const panelW = 340;
const panelH = 260;
const gap = 40;
const startX = (width - (3 * panelW + 2 * gap)) / 2;
const baseY = 230;

const panels: {
  label: string;
  borderSize: number;
  borderColor: string;
  borderStyle: "solid" | "dashed";
}[] = [
  { label: "solid", borderSize: 2, borderColor: "#4ea1ff", borderStyle: "solid" },
  { label: "dashed", borderSize: 2, borderColor: "#4ea1ff", borderStyle: "dashed" },
  { label: "thick", borderSize: 5, borderColor: "#7c5cff", borderStyle: "solid" },
];

const blocks = panels.map((p, i) => {
  const panel = new Block({
    x: startX + i * (panelW + gap),
    y: baseY,
    width: panelW,
    height: panelH,
    justifyContent: "center",
    alignItems: "center",
    background: "#161b22",
    borderSize: p.borderSize,
    borderColor: p.borderColor,
    borderStyle: p.borderStyle,
    cornerRadius: 14,
  });
  panel.add(
    new Text({
      text: p.label,
      flexGrow: 1,
      align: "center",
      fontSize: 24,
      fontFamily: mono,
      fill: "#f9fafb",
    }),
  );
  content.add(panel);
  return panel;
});

content.register((frame) => {
  blocks.forEach((panel, i) => {
    const a = interpolate(frame, [i * 10, i * 10 + 24], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    panel.opacity(a);
    panel.y(baseY + (1 - a) * 18);
  });
});

comp.add(content);
export default comp;
