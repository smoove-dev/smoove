import { type Composition, Rect, Sequence, Text } from "@smoove/core";
import { Dithering } from "@smoove/effects";
import { DURATION, H, makeComp, W } from "../_shared.js";

/**
 * SPHERE.EXE — a 1-bit renderer booting on old iron. The sphere spins in
 * pure two-color dithering while the machine walks through its ordered
 * matrices — random → 2×2 → 4×4 → 8×8 — and the pixels get finer each pass.
 * The terminal narrates.
 */
const comp: Composition = makeComp("fx-dithering");
const scene = new Sequence();

scene.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: "#010b03" }));

const dither = new Dithering({
  x: 240,
  y: -40,
  width: 800,
  height: 800,
  colorBack: "#010b03",
  colorFront: "#33ff66",
  shape: "sphere",
  type: "random",
  pxSize: 6,
  speed: 0.8,
});
scene.add(dither);

const prompt = new Text({
  x: 48,
  y: 40,
  text: "C:\\> RUN SPHERE.EXE",
  fontSize: 26,
  fontFamily: "monospace",
  fill: "#33ff66",
  typewriter: { mode: "letter", durationInFrames: 50 },
});
scene.add(prompt);

const matrix = new Text({
  x: 48,
  y: H - 76,
  text: "DITHER: RANDOM",
  fontSize: 26,
  fontFamily: "monospace",
  fill: "#33ff66",
  letterSpacing: 2,
});
scene.add(matrix);

const cursor = new Rect({ x: 48, y: H - 40, width: 16, height: 6, fill: "#33ff66" });
scene.add(cursor);

// One matrix per quarter of the loop; pixels get finer as quality climbs.
const STAGES = [
  { type: "random", px: 7 },
  { type: "2x2", px: 6 },
  { type: "4x4", px: 4 },
  { type: "8x8", px: 2 },
] as const;

scene.register((f) => {
  const t = f % DURATION;
  const stage = STAGES[Math.min(3, Math.floor(t / (DURATION / 4)))] as (typeof STAGES)[number];
  dither.type(stage.type);
  dither.pxSize(stage.px);
  matrix.setText(`DITHER: ${stage.type.toUpperCase()}   PX: ${stage.px}`);
  cursor.opacity(f % 40 < 24 ? 1 : 0);
});

comp.add(scene);

export default comp;
