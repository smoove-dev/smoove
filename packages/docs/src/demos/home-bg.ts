import { Circle, Composition, Ellipse, Line, RegularPolygon, Sequence } from "@smoove/core";

/**
 * Homepage background — an "orbital timeline" scene: slowly-breathing dashed
 * orbit rings carry glowing comets with fading motion trails, and sunshine
 * keyframe diamonds glide along flowing ribbon tracks below. Aurora glows and
 * twinkling sparks fill out the atmosphere. The docs hero plays it via
 * `<smoove-player src autoplay loop>` with no controls, pinned behind the page.
 *
 * Three design constraints shape it:
 *  - **Theme-agnostic.** No background Rect — the Konva stage stays transparent,
 *    so the page's own light/dark background shows through and the soft, glowing
 *    elements read on both.
 *  - **Square + edge-safe.** The stage is 1:1 so the page can cover any viewport
 *    from the center, and nothing (especially the aurora orbs) ever crosses the
 *    top/bottom edge — no shape gets visibly cut by the canvas frame. Keep every
 *    vertical extent inside [~90, ~1110].
 *  - **Seamless 30s loop.** Every motion term is `sin/cos(t · 2π · k)` with an
 *    integer `k`, so frame 0 and the last frame line up and the loop never
 *    jumps. Travellers that wrap (comet trails, the keyframe diamonds) fade to
 *    0 at their wrap point.
 */
const width = 1200;
const height = 1200;
const fps = 60;
const durationInFrames = fps * 30; // 30s — a long, slow, hypnotic loop
const TAU = Math.PI * 2;

const comp = new Composition({
  id: "home-bg",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
});

// Smoove palette: a coral↔mint field with sunshine reserved for the
// travelling keyframe diamonds and the brightest sparks (the "wink").
const CORAL = "#FF5640";
const MINT = "#15CDA8";
const SUNSHINE = "#FFC23C";

// Transparent stage (no base rect) so the page background shows through.
const scene = new Sequence({ from: 0, durationInFrames });

// --- Aurora orbs: big, soft, colored glows drifting on Lissajous paths -------
// Vertical travel is deliberately tight (by ∈ [0.42, 0.58], small ay) so
// body + breathing + drift never reaches the top/bottom edge — the glow fades
// out well inside the frame instead of being cut by it.
type Orb = {
  node: Circle;
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
    color: CORAL,
    bx: 0.24,
    by: 0.44,
    ax: 160,
    ay: 55,
    fx: 1,
    fy: 2,
    baseR: 170,
    dR: 40,
    phase: 0.0,
  },
  {
    color: MINT,
    bx: 0.76,
    by: 0.42,
    ax: 170,
    ay: 60,
    fx: 2,
    fy: 1,
    baseR: 185,
    dR: 45,
    phase: 1.3,
  },
  {
    color: MINT,
    bx: 0.42,
    by: 0.58,
    ax: 150,
    ay: 55,
    fx: 1,
    fy: 1,
    baseR: 160,
    dR: 40,
    phase: 2.6,
  },
  {
    color: CORAL,
    bx: 0.66,
    by: 0.56,
    ax: 140,
    ay: 50,
    fx: 2,
    fy: 2,
    baseR: 145,
    dR: 35,
    phase: 4.1,
  },
];

const orbs: Orb[] = ORB_SPECS.map((s) => {
  const node = new Circle({
    x: s.bx * width,
    y: s.by * height,
    radius: s.baseR,
    fill: s.color,
    opacity: 0.2,
    shadowColor: s.color,
    shadowBlur: 150,
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

// --- Orbit rings: dashed ellipses gently swaying around a shared center ------
// Rings wobble (±deg) instead of fully revolving — a full turn would sweep the
// wide ellipses through the top/bottom edges. Comets still do full orbits.
const RING_CX = width * 0.5;
const RING_CY = height * 0.45;

type RingSpec = {
  rx: number;
  ry: number;
  tilt: number; // base rotation, degrees
  sway: number; // wobble amplitude, degrees (seamless: 1 sine cycle per loop)
  swayPhase: number;
  breathe: number; // radius breathing amplitude
  color: string;
  opacity: number;
};

const RING_INNER: RingSpec = {
  rx: 330,
  ry: 190,
  tilt: -8,
  sway: 5,
  swayPhase: 0,
  breathe: 8,
  color: MINT,
  opacity: 0.2,
};
const RING_MID: RingSpec = {
  rx: 450,
  ry: 245,
  tilt: 6,
  sway: -6,
  swayPhase: 1.6,
  breathe: 12,
  color: CORAL,
  opacity: 0.16,
};
const RING_OUTER: RingSpec = {
  rx: 555,
  ry: 295,
  tilt: -4,
  sway: 4,
  swayPhase: 3.2,
  breathe: 14,
  color: MINT,
  opacity: 0.12,
};
const RING_SPECS: RingSpec[] = [RING_INNER, RING_MID, RING_OUTER];

const ringRotation = (ring: RingSpec, tt: number) =>
  ring.tilt + ring.sway * Math.sin(tt * TAU + ring.swayPhase);

const rings = RING_SPECS.map((s) => {
  const node = new Ellipse({
    x: RING_CX,
    y: RING_CY,
    radiusX: s.rx,
    radiusY: s.ry,
    rotation: s.tilt,
    stroke: s.color,
    strokeWidth: 1.5,
    dash: [3, 14],
    lineCap: "round",
    opacity: s.opacity,
    listening: false,
  });
  scene.add(node);
  return { ...s, node };
});

// --- Comets: bright heads with fading trails, riding the orbit rings ---------
// World position of a comet at loop-time `tt` — includes its ring's sway at
// that same instant, so trail dots (sampled at earlier times) land exactly on
// the comet's past path.
function orbitPos(ring: RingSpec, turns: number, phase: number, tt: number) {
  const rot = (ringRotation(ring, tt) * Math.PI) / 180;
  const a = phase + tt * TAU * turns;
  const ex = Math.cos(a) * (ring.rx + ring.breathe * Math.sin(tt * TAU));
  const ey = Math.sin(a) * (ring.ry + ring.breathe * Math.sin(tt * TAU));
  return {
    x: RING_CX + ex * Math.cos(rot) - ey * Math.sin(rot),
    y: RING_CY + ex * Math.sin(rot) + ey * Math.cos(rot),
  };
}

type CometSpec = {
  ring: RingSpec;
  turns: number; // signed integer orbits per loop
  phase: number;
  color: string;
  headR: number;
};

const COMET_SPECS: CometSpec[] = [
  { ring: RING_INNER, turns: 3, phase: 0.0, color: CORAL, headR: 6 },
  { ring: RING_INNER, turns: 3, phase: Math.PI, color: SUNSHINE, headR: 4.5 },
  { ring: RING_MID, turns: -2, phase: 1.2, color: MINT, headR: 6.5 },
  { ring: RING_OUTER, turns: 2, phase: 2.5, color: MINT, headR: 5.5 },
  { ring: RING_OUTER, turns: 2, phase: 5.2, color: CORAL, headR: 5 },
];

const TRAIL = 10;
const TRAIL_DT = 0.0045; // loop-time gap between trail samples (~0.14s)

const comets = COMET_SPECS.map((s) => {
  const head = new Circle({
    radius: s.headR,
    fill: s.color,
    opacity: 0.85,
    shadowColor: s.color,
    shadowBlur: 18,
    shadowOpacity: 0.9,
    listening: false,
  });
  const trail = Array.from({ length: TRAIL }, (_, i) => {
    const k = 1 - (i + 1) / (TRAIL + 1);
    const dot = new Circle({
      radius: s.headR * (0.25 + 0.6 * k),
      fill: s.color,
      opacity: 0.5 * k * k,
      listening: false,
    });
    scene.add(dot);
    return dot;
  });
  scene.add(head);
  return { ...s, head, trail };
});

// --- Ribbon tracks: flowing wave lines woven across the lower field ----------
type RibbonSpec = {
  baseY: number;
  amp: number;
  freq: number;
  speed: number;
  phase: number;
};

const SAMPLES = 48;
type RibbonStyle = RibbonSpec & { color: string; sw: number; op: number };
const RIBBON_A: RibbonStyle = {
  color: CORAL,
  baseY: 0.6,
  amp: 70,
  freq: 2,
  speed: 1,
  phase: 0.0,
  sw: 2.2,
  op: 0.26,
};
const RIBBON_B: RibbonStyle = {
  color: MINT,
  baseY: 0.7,
  amp: 90,
  freq: 3,
  speed: 2,
  phase: 1.1,
  sw: 2.0,
  op: 0.22,
};
const RIBBON_C: RibbonStyle = {
  color: MINT,
  baseY: 0.79,
  amp: 75,
  freq: 2,
  speed: 1,
  phase: 2.3,
  sw: 2.6,
  op: 0.18,
};
const RIBBON_SPECS: RibbonStyle[] = [RIBBON_A, RIBBON_B, RIBBON_C];

// y of a ribbon at horizontal position `u` (0..1) and loop-time `t` — shared by
// the ribbon polyline and the keyframe diamonds that ride it.
function ribbonY(s: RibbonSpec, u: number, t: number) {
  return (
    s.baseY * height +
    s.amp * Math.sin(u * TAU * s.freq + t * TAU * s.speed + s.phase) +
    s.amp * 0.35 * Math.sin(u * TAU * s.freq * 2 + t * TAU * s.speed * 2 + s.phase)
  );
}

const ribbonX = (u: number) => -120 + u * (width + 240);

const ribbons = RIBBON_SPECS.map((s) => {
  const node = new Line({
    points: [],
    stroke: s.color,
    strokeWidth: s.sw,
    opacity: s.op,
    lineCap: "round",
    lineJoin: "round",
    tension: 0.4,
    shadowColor: s.color,
    shadowBlur: 14,
    shadowOpacity: 0.5,
    listening: false,
  });
  scene.add(node);
  return { ...s, node };
});

// --- Keyframe diamonds: sunshine markers gliding along the ribbon tracks -----
type DiamondSpec = {
  ribbon: RibbonSpec;
  laps: number; // integer screen crossings per loop
  offset: number;
  spin: number; // integer revolutions per loop
  size: number;
};

const DIAMOND_SPECS: DiamondSpec[] = [
  { ribbon: RIBBON_A, laps: 2, offset: 0.15, spin: 2, size: 9 },
  { ribbon: RIBBON_A, laps: 2, offset: 0.65, spin: -2, size: 7 },
  { ribbon: RIBBON_B, laps: 3, offset: 0.4, spin: 3, size: 8 },
  { ribbon: RIBBON_C, laps: 2, offset: 0.85, spin: -2, size: 10 },
];

const diamonds = DIAMOND_SPECS.map((s) => {
  const node = new RegularPolygon({
    sides: 4,
    radius: s.size,
    fill: SUNSHINE,
    opacity: 0,
    shadowColor: SUNSHINE,
    shadowBlur: 12,
    shadowOpacity: 0.9,
    listening: false,
  });
  scene.add(node);
  return { ...s, node };
});

// --- Sparks: tiny twinkling motes that gently bob -----------------------------
type Spark = {
  node: Circle;
  x: number;
  y: number;
  amp: number;
  speed: number;
  phase: number;
};

const SPARK_COLORS = [CORAL, MINT, SUNSHINE, MINT, CORAL];
const sparks: Spark[] = Array.from({ length: 22 }, (_, i) => {
  // Deterministic pseudo-scatter (no Math.random — keeps the module pure).
  const gx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
  const gy = (Math.sin(i * 78.233) * 12543.4523) % 1;
  const x = (Math.abs(gx) * 0.9 + 0.05) * width;
  // Scatter band + bob amplitude stays inside the vertical safe zone.
  const y = (Math.abs(gy) * 0.72 + 0.14) * height;
  const color = SPARK_COLORS[i % SPARK_COLORS.length];
  const node = new Circle({
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

  for (const r of rings) {
    r.node.rotation(ringRotation(r, t));
    r.node.radiusX(r.rx + r.breathe * Math.sin(t * TAU));
    r.node.radiusY(r.ry + r.breathe * Math.sin(t * TAU));
  }

  for (const c of comets) {
    const head = orbitPos(c.ring, c.turns, c.phase, t);
    c.head.x(head.x);
    c.head.y(head.y);
    c.trail.forEach((dot, i) => {
      const p = orbitPos(c.ring, c.turns, c.phase, t - (i + 1) * TRAIL_DT);
      dot.x(p.x);
      dot.y(p.y);
    });
  }

  for (const r of ribbons) {
    const pts: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const u = i / SAMPLES;
      pts.push(ribbonX(u), ribbonY(r, u, t));
    }
    r.node.points(pts);
  }

  for (const d of diamonds) {
    // Wraps seamlessly: `laps` is an integer and opacity fades to 0 at u=0/1.
    const u = (((t * d.laps + d.offset) % 1) + 1) % 1;
    d.node.x(ribbonX(u));
    d.node.y(ribbonY(d.ribbon, u, t));
    d.node.rotation(45 + t * 360 * d.spin);
    d.node.opacity(0.85 * Math.sin(u * Math.PI));
  }

  for (const s of sparks) {
    s.node.y(s.y + s.amp * Math.sin(t * TAU * s.speed + s.phase));
    s.node.opacity(0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * TAU * s.speed + s.phase * 1.7)));
  }
});

export default comp;
