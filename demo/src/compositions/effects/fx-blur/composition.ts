import { Circle, type Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { BlurEffect } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * RACK FOCUS — a camera pulls focus between a foreground title and a
 * background of bokeh lights. Two BlurEffect instances with inverse radii do
 * exactly what a lens does: only one plane is ever sharp.
 */
const comp: Composition = makeComp("fx-blur");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#07090f" }));

// Background plane: a field of bokeh lights. One shared BlurEffect instance
// across all of them — a single focal plane.
const bgBlur = new BlurEffect({ radius: 0 });
const bokehColors = ["#ffb35c", "#ff5c8a", "#5cc8ff", "#b98cff", "#ffe45c"];
const lights: Circle[] = [];
for (let i = 0; i < 14; i++) {
  const gx = (i * 733) % W;
  const gy = 80 + ((i * 401) % (H - 200));
  const light = new Circle({
    x: gx,
    y: gy,
    radius: 14 + ((i * 37) % 26),
    fill: bokehColors[i % bokehColors.length],
    opacity: 0.9,
    effects: [bgBlur],
  });
  lights.push(light);
  scene.add(light);
}

// Foreground plane: the title card.
const fgBlur = new BlurEffect({ radius: 0 });
const title = new Text({
  x: 0,
  y: 280,
  width: W,
  text: "RACK FOCUS",
  fontSize: 110,
  fontStyle: "bold",
  align: "center",
  fill: "#f4f6fb",
  letterSpacing: 6,
  effects: [fgBlur],
});
scene.add(title);
const sub = new Text({
  x: 0,
  y: 412,
  width: W,
  text: "one lens · two planes · BlurEffect × 2",
  fontSize: 26,
  align: "center",
  fill: "#8b93a7",
  letterSpacing: 2,
  effects: [fgBlur],
});
scene.add(sub);

scene.register((f) => {
  // focus: 0 = front sharp, 1 = back sharp. Two full pulls per loop.
  const focus = interpolate(
    f % DURATION,
    [0, 90, 180, 270, 360, 450, DURATION],
    [0, 0, 1, 1, 0, 0, 0],
    { easing: Easing.inOut(Easing.cubic) },
  );
  fgBlur.radius(focus * 26);
  bgBlur.radius((1 - focus) * 22);
  // Bokeh drifts up slowly, like dust in the light (positive-modulo wrap).
  const span = H + 120;
  for (let i = 0; i < lights.length; i++) {
    const light = lights[i] as Circle;
    const gy = 80 + ((i * 401) % (H - 200));
    const y = ((((gy - f * (0.1 + (i % 5) * 0.06)) % span) + span) % span) - 60;
    light.y(y);
  }
});

comp.add(scene);

export default comp;
