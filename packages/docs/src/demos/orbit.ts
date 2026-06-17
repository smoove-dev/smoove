import { Composition, Sequence } from "@konva-motion/core";
import Konva from "konva";

/**
 * A self-contained demo composition served as its own ESM module. The docs load
 * it into `<km-player src=…>` via Vite's `?url` import (see `./registry.ts`) —
 * the player dynamically `import()`s this file at runtime, exactly as it would a
 * remote composition hosted elsewhere. Its default export is a `Composition`.
 */
const width = 1280;
const height = 720;
const durationInFrames = 180;

const comp = new Composition({
  id: "orbit",
  fps: 60,
  durationInFrames,
  loop: true,
  width,
  height,
});

const main = new Sequence({ from: 0, durationInFrames });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const cx = width / 2;
const cy = height / 2;

// Pulsing core.
const core = new Konva.Circle({
  x: cx,
  y: cy,
  radius: 26,
  fill: "#ffd166",
  shadowColor: "#ffd166",
  shadowBlur: 40,
  shadowOpacity: 0.8,
});
main.add(core);

// Orbiting satellites: radius, color, turns-per-loop, size.
const satellites = [
  { r: 110, color: "#4cc9f0", turns: 1, size: 12 },
  { r: 180, color: "#b5179e", turns: -1, size: 16 },
  { r: 250, color: "#80ffdb", turns: 2, size: 9 },
].map((cfg) => {
  // A faint orbit ring so the path reads even on the first frame.
  main.add(new Konva.Circle({ x: cx, y: cy, radius: cfg.r, stroke: "#1f2630", strokeWidth: 2 }));
  const dot = new Konva.Circle({
    x: cx + cfg.r,
    y: cy,
    radius: cfg.size,
    fill: cfg.color,
    shadowColor: cfg.color,
    shadowBlur: 24,
    shadowOpacity: 0.9,
  });
  main.add(dot);
  return { ...cfg, dot };
});

comp.add(main);

const TAU = Math.PI * 2;

main.register((frame) => {
  const t = frame / durationInFrames; // 0..1 over one loop

  // Core breathes twice per loop.
  core.radius(26 + 8 * Math.sin(t * TAU * 2));

  for (const sat of satellites) {
    const angle = t * TAU * sat.turns;
    sat.dot.x(cx + Math.cos(angle) * sat.r);
    sat.dot.y(cy + Math.sin(angle) * sat.r);
  }
});

export default comp;
