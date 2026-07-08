import { Circle, Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import { blur } from "@smoove/effects";
import Konva from "konva";

const FONT = "ui-sans-serif, system-ui, sans-serif";

const width = 1280;
const height = 720;
const fps = 60;
const duration = fps * 5;

const comp = new Composition({
  id: "fx-blur",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

// listening: false — the scene is non-interactive, so skip Konva's per-frame
// hit-canvas rasterization (a second full vector pass every batchDraw).
const main = new Sequence({ from: 0, durationInFrames: duration, listening: false });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const palette = ["#1f6feb", "#8957e5", "#db61a2", "#3fb950", "#f0883e", "#a5d6ff"];

// A moving bokeh field: orbs on two counter-rotating rings, each carrying its
// own blur that pulses on the frame clock — a per-node capture + filter pass
// per orb per frame.
const cx = width / 2;
const cy = height / 2;
const ORBS = 8;
type Orb = {
  node: Circle;
  fx: ReturnType<typeof blur>;
  ring: number;
  a0: number;
  phase: number;
};
const orbs: Orb[] = [];
for (let i = 0; i < ORBS; i++) {
  const ring = i % 2;
  const fx = blur({ radius: 8 });
  const node = new Circle({
    x: cx,
    y: cy,
    radius: 34 + ring * 24 + (i % 3) * 8,
    fill: palette[i % palette.length],
    opacity: 0.72,
    effects: [fx],
  });
  main.add(node);
  orbs.push({ node, fx, ring, a0: (i / ORBS) * Math.PI * 2, phase: i * 0.7 });
}

const focus = blur({ radius: 24 });
const title = new Text({
  x: 0,
  y: cy - 78,
  width,
  text: "smoove",
  fontSize: 156,
  fontStyle: "bold",
  fontFamily: FONT,
  align: "center",
  fill: "#e6edf3",
  effects: [focus],
});
main.add(title);

main.add(
  new Konva.Text({
    x: 0,
    y: height - 60,
    width,
    align: "center",
    text: "per-node blurs on moving orbs + a focus-pulling title",
    fontSize: 16,
    fontFamily: FONT,
    fill: "#7d8590",
  }),
);

comp.add(main);

main.register((frame) => {
  const t = (frame / duration) * Math.PI * 2;
  for (const o of orbs) {
    const rx = o.ring ? width * 0.42 : width * 0.22;
    const ry = o.ring ? height * 0.4 : height * 0.24;
    const dir = o.ring ? 1 : -1;
    const a = o.a0 + dir * t;
    o.node.x(cx + Math.cos(a) * rx);
    o.node.y(cy + Math.sin(a) * ry);
    o.fx.radius = 3 + 9 * (0.5 + 0.5 * Math.sin(t * 2 + o.phase));
  }
  focus.radius = interpolate(frame, [0, duration / 2, duration], [24, 0, 24], {
    easing: Easing.inOut(Easing.quad),
  });
});

export default comp;
