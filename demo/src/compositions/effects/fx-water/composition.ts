import { Composition, interpolate, RegularPolygon, Sequence } from "@smoove/core";
import { water } from "@smoove/effects";
import Konva from "konva";

const FONT = "ui-sans-serif, system-ui, sans-serif";

const width = 1280;
const height = 720;
const fps = 60;
const duration = fps * 6;

const comp = new Composition({
  id: "fx-water",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

// listening: false — non-interactive, so skip Konva's per-frame hit-canvas pass.
const main = new Sequence({ from: 0, durationInFrames: duration, listening: false });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#08131f" }));

// Several shapes, each with its own water shader pass, spinning and drifting.
// The capture region follows every node per frame, so rotation and the shader
// distortion compose freely — a stress test of multiple GL passes per frame.
type Fluid = {
  node: RegularPolygon;
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  phase: number;
  spin: number;
};
const fluids: Fluid[] = [];

function gradientFill(node: RegularPolygon, r: number, a: string, b: string, c: string) {
  node.fillLinearGradientStartPoint({ x: -r, y: -r });
  node.fillLinearGradientEndPoint({ x: r, y: r });
  node.fillLinearGradientColorStops([0, a, 0.5, b, 1, c]);
  node.fillPriority("linear-gradient");
}

const triangle = new RegularPolygon({
  x: width * 0.34,
  y: height * 0.46,
  sides: 3,
  radius: 140,
  stroke: "#9ecbff",
  strokeWidth: 6,
  effects: [water({ waves: 0.55, caustic: 0.28, edges: 0.9, size: 1.3, speed: 1.2 })],
});
gradientFill(triangle, 140, "#0b3d91", "#1f6feb", "#66d9e8");
main.add(triangle);
fluids.push({
  node: triangle,
  cx: width * 0.34,
  cy: height * 0.46,
  ax: 44,
  ay: 30,
  phase: 0,
  spin: 1,
});

const hexagon = new RegularPolygon({
  x: width * 0.66,
  y: height * 0.5,
  sides: 6,
  radius: 130,
  stroke: "#a5f3d0",
  strokeWidth: 6,
  effects: [water({ waves: 0.4, caustic: 0.35, edges: 1, size: 1, speed: 0.9 })],
});
gradientFill(hexagon, 130, "#0b5d4a", "#06d6a0", "#c7f9e5");
main.add(hexagon);
fluids.push({
  node: hexagon,
  cx: width * 0.66,
  cy: height * 0.5,
  ax: 38,
  ay: 46,
  phase: 2.1,
  spin: -1,
});

main.add(
  new Konva.Text({
    x: 0,
    y: height - 52,
    width,
    align: "center",
    text: "water shader passes per frame on spinning, drifting shapes (WebGL; skipped gracefully without it)",
    fontSize: 16,
    fontFamily: FONT,
    fill: "#5e7284",
  }),
);

comp.add(main);

main.register((frame) => {
  const t = (frame / duration) * Math.PI * 2;
  for (const f of fluids) {
    f.node.x(f.cx + Math.cos(t + f.phase) * f.ax);
    f.node.y(f.cy + Math.sin(t * 1.3 + f.phase) * f.ay);
    f.node.rotation(interpolate(frame, [0, duration], [0, 360 * f.spin]));
  }
});

export default comp;
