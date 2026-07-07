import {
  Circle,
  Composition,
  interpolate,
  RegularPolygon,
  Sequence,
  Star,
  Text,
} from "@smoove/core";
import { chromaKey } from "@smoove/effects";
import Konva from "konva";

const FONT = "ui-sans-serif, system-ui, sans-serif";
const SCREEN_GREEN = "#00b140";

const width = 1280;
const height = 720;
const fps = 60;
const duration = fps * 5;

const comp = new Composition({
  id: "fx-chroma-key",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const palette = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#f78c6b", "#c77dff"];

// --- The backdrop the keyed footage composites over. -----------------------
const backdrop = new Sequence({ from: 0, durationInFrames: duration, listening: false });
const sky = new Konva.Rect({ x: 0, y: 0, width, height });
sky.fillLinearGradientStartPoint({ x: 0, y: 0 });
sky.fillLinearGradientEndPoint({ x: 0, y: height });
sky.fillLinearGradientColorStops([0, "#1c2541", 0.6, "#3a506b", 1, "#5b7b9a"]);
sky.fillPriority("linear-gradient");
backdrop.add(sky);
const clouds: Circle[] = [];
for (let i = 0; i < 6; i++) {
  const c = new Circle({
    x: 0,
    y: 120 + (i % 3) * 200,
    radius: 60 + (i % 3) * 40,
    fill: "#8ecae6",
    opacity: 0.35,
  });
  backdrop.add(c);
  clouds.push(c);
}
comp.add(backdrop);

// --- The "green screen footage": many moving subjects on a green fill. ------
// chromaKey runs once over the whole Sequence layer, so subject count adds no
// keying cost — the green vanishes and every subject composites through.
const footage = new Sequence({ from: 0, durationInFrames: duration, listening: false });
footage.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: SCREEN_GREEN }));

const star = new Star({
  x: width / 2,
  y: height / 2,
  numPoints: 5,
  innerRadius: 60,
  outerRadius: 130,
  fill: "#ffd166",
  stroke: "#fff",
  strokeWidth: 4,
});
footage.add(star);

type Sub = { node: RegularPolygon; a0: number; sides: number };
const subs: Sub[] = [];
const RING = 6;
for (let i = 0; i < RING; i++) {
  const sides = 3 + (i % 4);
  const node = new RegularPolygon({
    x: width / 2,
    y: height / 2,
    sides,
    radius: 46,
    fill: palette[i % palette.length],
    stroke: "#ffffff",
    strokeWidth: 3,
  });
  footage.add(node);
  subs.push({ node, a0: (i / RING) * Math.PI * 2, sides });
}
footage.add(
  new Text({
    x: 0,
    y: height / 2 - 20,
    width,
    align: "center",
    text: "keyed",
    fontSize: 26,
    fontStyle: "bold",
    fontFamily: FONT,
    fill: "#ffffff",
  }),
);
footage.effects([chromaKey({ color: SCREEN_GREEN })]);
comp.add(footage);

// --- Unkeyed source inset for the before/after. ----------------------------
const inset = new Sequence({ from: 0, durationInFrames: duration, listening: false });
const insetW = 240;
const insetH = 135;
const ix = width - insetW - 28;
const iy = height - insetH - 52;
inset.add(
  new Konva.Rect({
    x: ix,
    y: iy,
    width: insetW,
    height: insetH,
    fill: SCREEN_GREEN,
    stroke: "#30363d",
    strokeWidth: 2,
  }),
);
const insetStar = new Star({
  x: ix + insetW / 2,
  y: iy + insetH / 2,
  numPoints: 5,
  innerRadius: 14,
  outerRadius: 30,
  fill: "#ffd166",
  stroke: "#fff",
  strokeWidth: 1,
});
inset.add(insetStar);
inset.add(
  new Konva.Text({
    x: ix,
    y: iy + insetH + 8,
    width: insetW,
    align: "center",
    text: "source (no effect)",
    fontSize: 13,
    fontFamily: FONT,
    fill: "#7d8590",
  }),
);
inset.add(
  new Konva.Text({
    x: 0,
    y: height - 44,
    width,
    align: "center",
    text: "chromaKey() on the footage Sequence — one layer pass keys every moving subject",
    fontSize: 16,
    fontFamily: FONT,
    fill: "#7d8590",
  }),
);
comp.add(inset);

footage.register((frame) => {
  const t = (frame / duration) * Math.PI * 2;
  star.rotation(interpolate(frame, [0, duration], [0, 360]));
  const pulse = 1 + 0.12 * Math.sin(t * 3);
  star.scale({ x: pulse, y: pulse });
  for (const s of subs) {
    const a = s.a0 + t;
    const orbit = 250 + 40 * Math.sin(t * 2 + s.a0);
    s.node.x(width / 2 + Math.cos(a) * orbit);
    s.node.y(height / 2 + Math.sin(a) * orbit * 0.62);
    s.node.rotation(interpolate(frame, [0, duration], [0, s.sides % 2 === 0 ? 360 : -360]));
    const sp = 0.8 + 0.35 * Math.sin(t * 2.5 + s.a0);
    s.node.scale({ x: sp, y: sp });
  }
});

inset.register((frame) => {
  insetStar.rotation(interpolate(frame, [0, duration], [0, 360]));
});

export default comp;
