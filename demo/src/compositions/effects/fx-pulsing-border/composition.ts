import { Circle, type Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";
import { PulsingBorder } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * LISTENING — the ambient frame of a voice assistant. PulsingBorder wraps
 * the whole screen: calm while idle, blooming and smoking while it
 * "listens", then settling as the answer types out. The border IS the UI.
 */
const comp: Composition = makeComp("fx-pulsing-border");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#05060c" }));

const border = new PulsingBorder({
  width: W,
  height: H,
  colors: ["#0dc1fd", "#d915ef", "#ff3f2ecc"],
  colorBack: "#00000000",
  roundness: 0.12,
  thickness: 0.08,
  softness: 0.8,
  intensity: 0.1,
  bloom: 0.3,
  spots: 4,
  spotSize: 0.45,
  pulse: 0.2,
  smoke: 0.2,
  smokeSize: 0.5,
  speed: 1,
});
scene.add(border);

const dot = new Circle({ x: W / 2, y: 300, radius: 10, fill: "#0dc1fd" });
scene.add(dot);

const line = new Text({
  x: 0,
  y: 370,
  width: W,
  align: "center",
  text: "How can I help?",
  fontSize: 44,
  fill: "#e8ecff",
  opacity: 0,
});
scene.add(line);

const state = new Text({
  x: 0,
  y: H - 70,
  width: W,
  align: "center",
  text: "idle",
  fontSize: 20,
  fontFamily: "monospace",
  fill: "#5c6484",
  letterSpacing: 6,
});
scene.add(state);

scene.register((f) => {
  const t = f % DURATION;
  // idle (0–90) → listening (90–300) → answering (300–420) → idle again.
  const listening = interpolate(t, [90, 140, 300, 360], [0, 1, 1, 0], {
    easing: Easing.inOut(Easing.quad),
  });
  border.intensity(0.08 + 0.25 * listening);
  border.pulse(0.15 + 0.55 * listening);
  border.smoke(0.15 + 0.5 * listening);
  border.spotSize(0.4 + 0.3 * listening);
  border.thickness(0.06 + 0.06 * listening);
  // The dot breathes with the border.
  const breath = 1 + 0.5 * listening * Math.sin((t / 20) * Math.PI);
  dot.scale({ x: breath, y: breath });
  line.opacity(interpolate(t, [300, 340, 440, 475], [0, 1, 1, 0]));
  state.setText(t < 90 ? "idle" : t < 320 ? "listening…" : "answering");
});

comp.add(scene);

export default comp;
