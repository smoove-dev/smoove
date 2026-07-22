import { Circle, Composition, Rect, Sequence } from "@smoove/core";
import { smooveMark } from "../tickable-mark/smoove-mark";

// ---------------------------------------------------------------------------
// Clip punch-out — the clip's CONTENT is the eraser.
//
// Two stacked sequences (each Sequence = its own canvas): the lower one drifts
// colorful orbs, the upper one is a near-black cover. The smooveMark clip sits
// on the cover with `punchOut: true`, so every shape it draws erases the cover
// (`destination-out`) — the animated mark becomes a logo-shaped hole revealing
// the orbs below. Draw order matters: the mark is added after the cover.
// ---------------------------------------------------------------------------

const width = 1280;
const height = 720;
const fps = 30;

const comp = new Composition({
  id: "clip-punch",
  fps,
  durationInFrames: fps * 8,
  width,
  height,
  loop: true,
});

// -- below: drifting orbs to be revealed ------------------------------------
const bg = new Sequence();
bg.add(new Rect({ x: 0, y: 0, width, height, fill: "#101726" }));

const ORBS = [
  { color: "#FF5640", r: 260, cx: 380, cy: 300, ax: 160, ay: 90, speed: 0.35, phase: 0 },
  { color: "#15CDA8", r: 300, cx: 860, cy: 420, ax: 190, ay: 120, speed: 0.27, phase: 2.1 },
  { color: "#FFC23C", r: 220, cx: 640, cy: 220, ax: 130, ay: 150, speed: 0.42, phase: 4.2 },
  { color: "#7C5CFF", r: 240, cx: 520, cy: 520, ax: 210, ay: 80, speed: 0.31, phase: 1.2 },
].map((o) => {
  // Radial-gradient orbs (no shadowBlur — see the performance rule).
  const node = new Circle({
    x: o.cx,
    y: o.cy,
    radius: o.r,
    fillRadialGradientStartPoint: { x: 0, y: 0 },
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: o.r,
    fillRadialGradientColorStops: [0, o.color, 1, "rgba(16,23,38,0)"],
  });
  bg.add(node);
  return { ...o, node };
});

bg.register((_frame, { time }) => {
  for (const o of ORBS) {
    const t = time * o.speed * Math.PI * 2 + o.phase;
    o.node.x(o.cx + Math.sin(t) * o.ax);
    o.node.y(o.cy + Math.cos(t * 0.8) * o.ay);
  }
});
comp.add(bg);

// -- above: the cover, punched by the mark's own content ---------------------
const fg = new Sequence();
fg.add(new Rect({ x: 0, y: 0, width, height, fill: "#07090d" }));

const SIZE = 620;
fg.add(
  smooveMark({
    size: SIZE,
    x: (width - SIZE) / 2,
    y: (height - SIZE) / 2,
    loop: 4,
    punchOut: true,
  }),
);
comp.add(fg);

export default comp;
