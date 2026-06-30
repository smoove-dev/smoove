import {
  Arc,
  Arrow,
  Circle,
  Composition,
  Easing,
  Ellipse,
  Line,
  Path,
  Rect,
  RegularPolygon,
  Ring,
  Sequence,
  Star,
  Wedge,
  interpolate,
} from "@smoove/core";
import Konva from "konva";

/**
 * The drawing vocabulary on one canvas. Every shape here is imported from
 * @smoove/core, not Konva.* directly: each one extends its Konva
 * equivalent and adds flex participation. A single shared pulse drives all of
 * them so the gallery reads as motion, not a still.
 */
const FONT = "ui-sans-serif, system-ui, sans-serif";
const MUTED = "#7d8590";

const width = 1280;
const height = 720;
const duration = 180;

const comp = new Composition({
  id: "shapes-gallery",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: duration });
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

function label(text: string, x: number, y: number): Konva.Text {
  return new Konva.Text({
    x: x - 70,
    y: y + 80,
    width: 140,
    align: "center",
    text,
    fontSize: 15,
    fontFamily: FONT,
    fill: MUTED,
  });
}

// A 4 x 3 grid of cells; each shape sits centered in its cell.
const cols = 4;
const cellW = width / cols;
const rowY0 = 180;
const rowY1 = 400;
const rowY2 = 620;
const cx = (col: number) => cellW * col + cellW / 2;

const accent = "#7c5cff";
const accent2 = "#39c6c0";
const accent3 = "#f0c000";

// Row 1
const rect = new Rect({
  x: cx(0) - 60,
  y: rowY0 - 45,
  width: 120,
  height: 90,
  fill: accent,
  cornerRadius: 14,
});
const circle = new Circle({ x: cx(1), y: rowY0, radius: 55, fill: accent2 });
const ellipse = new Ellipse({ x: cx(2), y: rowY0, radiusX: 70, radiusY: 45, fill: accent3 });
const star = new Star({
  x: cx(3),
  y: rowY0,
  numPoints: 5,
  innerRadius: 28,
  outerRadius: 60,
  fill: "#ff7b72",
});

// Row 2
const ring = new Ring({
  x: cx(0),
  y: rowY1,
  innerRadius: 30,
  outerRadius: 58,
  fill: "#388bfd",
});
const arc = new Arc({
  x: cx(1),
  y: rowY1,
  innerRadius: 32,
  outerRadius: 60,
  angle: 240,
  fill: "#3fb950",
});
const wedge = new Wedge({ x: cx(2), y: rowY1, radius: 60, angle: 270, fill: "#bc8cff" });
const polygon = new RegularPolygon({ x: cx(3), y: rowY1, sides: 6, radius: 60, fill: "#f78166" });

// Row 3
const line = new Line({
  x: cx(0) - 70,
  y: rowY2,
  points: [0, 30, 45, -30, 90, 25, 140, -20],
  stroke: accent2,
  strokeWidth: 5,
  lineCap: "round",
  lineJoin: "round",
});
const arrow = new Arrow({
  x: cx(1) - 60,
  y: rowY2,
  points: [0, 0, 120, 0],
  stroke: accent3,
  fill: accent3,
  strokeWidth: 6,
  pointerLength: 16,
  pointerWidth: 16,
});
// A heart-ish SVG path; Path measures its own bounds from the data.
const path = new Path({
  x: cx(2) - 45,
  y: rowY2 - 40,
  data: "M45 80 C 10 50 10 15 45 30 C 80 15 80 50 45 80 Z",
  fill: "#ff7b72",
});

const shapes = [rect, circle, ellipse, star, ring, arc, wedge, polygon, line, arrow, path] as const;
for (const s of shapes) main.add(s);

main.add(label("Rect", cx(0), rowY0));
main.add(label("Circle", cx(1), rowY0));
main.add(label("Ellipse", cx(2), rowY0));
main.add(label("Star", cx(3), rowY0));
main.add(label("Ring", cx(0), rowY1));
main.add(label("Arc", cx(1), rowY1));
main.add(label("Wedge", cx(2), rowY1));
main.add(label("RegularPolygon", cx(3), rowY1));
main.add(label("Line", cx(0), rowY2));
main.add(label("Arrow", cx(1), rowY2));
main.add(label("Path", cx(2), rowY2));

main.register((frame) => {
  // One shared breath: scale every shape up and back across the loop.
  const scale = interpolate(frame, [0, duration / 2, duration], [0.92, 1.06, 0.92], {
    easing: Easing.inOut(Easing.sin),
  });
  for (const s of shapes) s.scale({ x: scale, y: scale });
});

comp.add(main);
export default comp;
