import { Composition, Sequence } from "@smoove/core";
import Konva from "konva";

/**
 * Homepage hero background — a long, seamlessly-looping "aurora" animation built
 * the same way as any other demo: a {@link Composition} whose every frame is a
 * pure function of the playhead. The docs hero plays it via
 * `<smoove-player src autoplay loop>` with no controls, letterboxed behind the
 * headline.
 *
 * Two design constraints shape it:
 *  - **Theme-agnostic.** No background Rect — the Konva stage stays transparent,
 *    so the page's own light/dark background shows through and the soft, glowing
 *    elements read on both.
 *  - **Seamless 30s loop.** Every motion term is `sin/cos(t · 2π · k)` with an
 *    integer `k`, so frame 0 and the last frame line up and the loop never jumps.
 */
const width = 1600;
const height = 900;
const fps = 60;
const durationInFrames = fps * 30; // 30s — a long, slow, hypnotic loop
const TAU = Math.PI * 2;

const comp = new Composition({
  id: "hero-bg",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
});

// Transparent stage (no base rect) so the page background shows through.
const scene = new Sequence({ from: 0, durationInFrames });

// --- Aurora orbs: big, soft, colored glows drifting on Lissajous paths -------
type Orb = {
  node: Konva.Circle;
  bx: number;
  by: number;
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  baseR: number;
  dR: number;
  phase: number;
};

const ORB_SPECS = [
  {
    color: "#34d399",
    bx: 0.3,
    by: 0.4,
    ax: 220,
    ay: 130,
    fx: 1,
    fy: 2,
    baseR: 200,
    dR: 50,
    phase: 0.0,
  },
  {
    color: "#06b6d4",
    bx: 0.68,
    by: 0.34,
    ax: 260,
    ay: 150,
    fx: 2,
    fy: 1,
    baseR: 230,
    dR: 60,
    phase: 1.1,
  },
  {
    color: "#7c5cff",
    bx: 0.52,
    by: 0.62,
    ax: 200,
    ay: 170,
    fx: 1,
    fy: 1,
    baseR: 210,
    dR: 55,
    phase: 2.4,
  },
  {
    color: "#ec4899",
    bx: 0.8,
    by: 0.66,
    ax: 180,
    ay: 120,
    fx: 2,
    fy: 2,
    baseR: 170,
    dR: 45,
    phase: 3.3,
  },
  {
    color: "#22d3ee",
    bx: 0.16,
    by: 0.7,
    ax: 160,
    ay: 110,
    fx: 1,
    fy: 2,
    baseR: 160,
    dR: 40,
    phase: 4.7,
  },
];

const orbs: Orb[] = ORB_SPECS.map((s) => {
  const node = new Konva.Circle({
    x: s.bx * width,
    y: s.by * height,
    radius: s.baseR,
    fill: s.color,
    opacity: 0.22,
    shadowColor: s.color,
    shadowBlur: 180,
    shadowOpacity: 0.55,
    listening: false,
  });
  scene.add(node);
  return {
    node,
    bx: s.bx * width,
    by: s.by * height,
    ax: s.ax,
    ay: s.ay,
    fx: s.fx,
    fy: s.fy,
    baseR: s.baseR,
    dR: s.dR,
    phase: s.phase,
  };
});

// --- Silk ribbons: flowing wave lines woven across the field -----------------
type Ribbon = {
  node: Konva.Line;
  baseY: number;
  amp: number;
  freq: number;
  speed: number;
  phase: number;
};

const SAMPLES = 56;
const RIBBON_SPECS = [
  { color: "#34d399", baseY: 0.34, amp: 80, freq: 2, speed: 1, phase: 0.0, sw: 2.5, op: 0.3 },
  { color: "#06b6d4", baseY: 0.44, amp: 110, freq: 3, speed: 2, phase: 1.0, sw: 2.0, op: 0.26 },
  { color: "#7c5cff", baseY: 0.52, amp: 95, freq: 2, speed: 1, phase: 2.0, sw: 3.0, op: 0.24 },
  { color: "#22d3ee", baseY: 0.6, amp: 130, freq: 3, speed: 2, phase: 0.6, sw: 2.0, op: 0.22 },
  { color: "#ec4899", baseY: 0.5, amp: 70, freq: 4, speed: 3, phase: 3.1, sw: 1.8, op: 0.2 },
];

const ribbons: Ribbon[] = RIBBON_SPECS.map((s) => {
  const node = new Konva.Line({
    points: [],
    stroke: s.color,
    strokeWidth: s.sw,
    opacity: s.op,
    lineCap: "round",
    lineJoin: "round",
    tension: 0.4,
    shadowColor: s.color,
    shadowBlur: 16,
    shadowOpacity: 0.5,
    listening: false,
  });
  scene.add(node);
  return {
    node,
    baseY: s.baseY * height,
    amp: s.amp,
    freq: s.freq,
    speed: s.speed,
    phase: s.phase,
  };
});

// --- Sparks: tiny twinkling motes that gently bob -----------------------------
type Spark = {
  node: Konva.Circle;
  x: number;
  y: number;
  amp: number;
  speed: number;
  phase: number;
};

const SPARK_COLORS = ["#34d399", "#06b6d4", "#7c5cff", "#22d3ee", "#ec4899"];
const sparks: Spark[] = Array.from({ length: 28 }, (_, i) => {
  // Deterministic pseudo-scatter (no Math.random — keeps the module pure).
  const gx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
  const gy = (Math.sin(i * 78.233) * 12543.4523) % 1;
  const x = (Math.abs(gx) * 0.96 + 0.02) * width;
  const y = (Math.abs(gy) * 0.9 + 0.05) * height;
  const color = SPARK_COLORS[i % SPARK_COLORS.length];
  const node = new Konva.Circle({
    x,
    y,
    radius: 2 + (i % 3),
    fill: color,
    opacity: 0.5,
    shadowColor: color,
    shadowBlur: 10,
    shadowOpacity: 0.9,
    listening: false,
  });
  scene.add(node);
  return { node, x, y, amp: 14 + (i % 4) * 6, speed: 1 + (i % 3), phase: i * 0.7 };
});

comp.add(scene);

scene.register((frame) => {
  const t = frame / durationInFrames; // 0..1 over the whole loop

  for (const o of orbs) {
    o.node.x(o.bx + o.ax * Math.sin(t * TAU * o.fx + o.phase));
    o.node.y(o.by + o.ay * Math.cos(t * TAU * o.fy + o.phase));
    o.node.radius(o.baseR + o.dR * Math.sin(t * TAU + o.phase));
  }

  for (const r of ribbons) {
    const pts: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const u = i / SAMPLES;
      const x = -120 + u * (width + 240);
      const y =
        r.baseY +
        r.amp * Math.sin(u * TAU * r.freq + t * TAU * r.speed + r.phase) +
        r.amp * 0.35 * Math.sin(u * TAU * r.freq * 2 + t * TAU * r.speed * 2 + r.phase);
      pts.push(x, y);
    }
    r.node.points(pts);
  }

  for (const s of sparks) {
    s.node.y(s.y + s.amp * Math.sin(t * TAU * s.speed + s.phase));
    s.node.opacity(0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * TAU * s.speed + s.phase * 1.7)));
  }
});

export default comp;
