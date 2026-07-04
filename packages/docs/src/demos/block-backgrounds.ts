import {
  type BackgroundValue,
  Block,
  Composition,
  interpolate,
  Rect,
  Sequence,
  Text,
} from "@smoove/core";

/**
 * The three background options on Block, side by side: a solid color, a linear
 * gradient, and a radial gradient. The panels fade up on a small stagger so the
 * gallery reads as live, then hold.
 */
const width = 1280;
const height = 720;
const fps = 60;
const duration = fps * 2.5;
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "block-backgrounds",
  fps,
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

const panels: { label: string; background: BackgroundValue }[] = [
  { label: "solid", background: "#d67f15" },
  {
    label: "linear",
    background: {
      gradient: {
        type: "linear",
        angle: 135,
        stops: [
          [0, "#d67f15"],
          [1, "#8dd214"],
        ],
      },
    },
  },
  {
    label: "radial",
    background: {
      gradient: {
        type: "radial",
        stops: [
          [0, "#adf700"],
          [1, "#00a6ff"],
        ],
      },
    },
  },
];

const blocks = panels.map((p, i) => {
  const panel = new Block({
    x: startX + i * (panelW + gap),
    y: baseY,
    width: panelW,
    height: panelH,
    justifyContent: "center",
    alignItems: "center",

    background: p.background,
    cornerRadius: 16,
  });
  panel.add(
    new Text({
      text: p.label,
      align: "center",
      fontSize: 24,
      flexGrow: 1,
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
