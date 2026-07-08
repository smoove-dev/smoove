import { Circle, Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { shine } from "@smoove/effects";
import Konva from "konva";

const FONT = "ui-sans-serif, system-ui, sans-serif";

const width = 1280;
const height = 720;
const fps = 60;
const duration = fps * 4;

const comp = new Composition({
  id: "fx-shine",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

// listening: false — non-interactive, so skip Konva's per-frame hit-canvas pass.
const main = new Sequence({ from: 0, durationInFrames: duration, listening: false });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

// --- Gold card with its own sweep. -----------------------------------------
const cardShine = shine({ angle: 25, width: 150, intensity: 0.85 });
const card = new Rect({
  x: width / 2 - 300,
  y: 120,
  width: 600,
  height: 200,
  cornerRadius: 24,
  stroke: "#8a6508",
  strokeWidth: 2,
  effects: [cardShine],
});
card.fillLinearGradientStartPoint({ x: 0, y: 0 });
card.fillLinearGradientEndPoint({ x: 600, y: 200 });
card.fillLinearGradientColorStops([0, "#9a7b1c", 0.5, "#d4af37", 1, "#8a6508"]);
card.fillPriority("linear-gradient");
main.add(card);

const titleShine = shine({ angle: 25, width: 100, intensity: 1 });
const title = new Text({
  x: 0,
  y: 176,
  width,
  align: "center",
  text: "PREMIUM",
  fontSize: 84,
  fontStyle: "bold",
  fontFamily: FONT,
  letterSpacing: 14,
  fill: "#fff8e1",
  effects: [titleShine],
});
main.add(title);

// --- A shelf of medals, each shining and bobbing on its own phase. ----------
type Medal = {
  node: Circle;
  label: Konva.Text;
  fx: ReturnType<typeof shine>;
  x: number;
  y: number;
  delay: number;
  phase: number;
};
const medals: Medal[] = [];
const MEDALS = 4;
const gap = 200;
const startX = width / 2 - ((MEDALS - 1) * gap) / 2;
for (let i = 0; i < MEDALS; i++) {
  const fx = shine({ angle: 20, width: 60, intensity: 1 });
  const x = startX + i * gap;
  const y = 500;
  const node = new Circle({
    x,
    y,
    radius: 62,
    stroke: "#b8860b",
    strokeWidth: 4,
    effects: [fx],
  });
  node.fillRadialGradientStartPoint({ x: 0, y: 0 });
  node.fillRadialGradientEndPoint({ x: 0, y: 0 });
  node.fillRadialGradientStartRadius(0);
  node.fillRadialGradientEndRadius(62);
  node.fillRadialGradientColorStops([0, "#ffe9a8", 1, "#c9971f"]);
  node.fillPriority("radial-gradient");
  main.add(node);
  const label = new Konva.Text({
    x: x - 62,
    y: y - 20,
    width: 124,
    align: "center",
    text: `${i + 1}`,
    fontSize: 40,
    fontStyle: "bold",
    fontFamily: FONT,
    fill: "#6b4e08",
  });
  main.add(label);
  medals.push({ node, label, fx, x, y, delay: 12 + i * 8, phase: i * 0.9 });
}

main.add(
  new Konva.Text({
    x: 0,
    y: height - 46,
    width,
    align: "center",
    text: "source-atop sweeps — card, title, and a shelf of bobbing medals",
    fontSize: 16,
    fontFamily: FONT,
    fill: "#7d8590",
  }),
);

comp.add(main);

const sweep = (frame: number, start: number) =>
  interpolate(frame, [start, start + 50], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

main.register((frame) => {
  const t = (frame / duration) * Math.PI * 2;
  cardShine.progress = sweep(frame, 10);
  titleShine.progress = sweep(frame, 24);
  for (const m of medals) {
    // Bob vertically (translation) while the sweep runs on its own delay.
    const dy = Math.sin(t * 2 + m.phase) * 14;
    m.node.y(m.y + dy);
    m.label.y(m.y - 20 + dy);
    m.fx.progress = sweep(frame, m.delay);
  }
});

export default comp;
