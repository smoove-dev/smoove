import { type Composition, Image, Line, Rect, Sequence, Text } from "@smoove/core";
import { HeatmapEffect } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * THERMAL — a FLIR camera boots up. HeatmapEffect maps the scene's luminance
 * onto an iron color ramp; a scan line sweeps, the palette bands into
 * contours mid-loop, and the HUD reads out a drifting core temperature.
 */
const comp: Composition = makeComp("fx-heatmap");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#000000" }));

const heatmap = new HeatmapEffect({ contour: 0, offset: 0 });
const photo = new Image({
  src: "https://picsum.photos/seed/fx-thermal/1280/720",
  x: 0,
  y: 0,
  width: W,
  height: H,
  effects: [heatmap],
});
scene.add(photo);

// Scan line.
const scan = new Rect({ x: 0, y: 0, width: W, height: 3, fill: "#ffffff", opacity: 0.5 });
scene.add(scan);

// HUD chrome — plain white, drawn above the thermal image.
const hudColor = "#eef2f5";
scene.add(
  new Text({
    x: 36,
    y: 28,
    text: "THERM-CAM 07",
    fontSize: 22,
    fontFamily: "monospace",
    fill: hudColor,
    letterSpacing: 4,
  }),
);
const temp = new Text({
  x: 36,
  y: H - 60,
  text: "CORE 36.6°",
  fontSize: 26,
  fontFamily: "monospace",
  fill: hudColor,
  letterSpacing: 4,
});
scene.add(temp);
const mode = new Text({
  x: 0,
  y: 28,
  width: W - 36,
  align: "right",
  text: "MODE: SMOOTH",
  fontSize: 22,
  fontFamily: "monospace",
  fill: hudColor,
  letterSpacing: 4,
});
scene.add(mode);

// Crosshair.
scene.add(
  new Line({ points: [W / 2 - 30, H / 2, W / 2 + 30, H / 2], stroke: hudColor, strokeWidth: 1 }),
);
scene.add(
  new Line({ points: [W / 2, H / 2 - 30, W / 2, H / 2 + 30], stroke: hudColor, strokeWidth: 1 }),
);

scene.register((f) => {
  const t = f % DURATION;
  // The ramp slides continuously — heat shimmering through the image.
  heatmap.offset((t / DURATION) * 0.3);
  // Halfway through, the camera switches to contour (banded isotherm) mode.
  const contours = t > 240 && t < 420;
  heatmap.contour(contours ? 10 : 0);
  mode.setText(contours ? "MODE: ISOTHERM" : "MODE: SMOOTH");
  // Scan line sweeps top→bottom twice per loop.
  scan.y(((t * 2) % DURATION) * (H / DURATION));
  // Temperature readout drifts deterministically.
  const core = 36.6 + Math.sin((t / DURATION) * Math.PI * 4) * 1.8;
  temp.setText(`CORE ${core.toFixed(1)}°`);
});

comp.add(scene);

export default comp;
