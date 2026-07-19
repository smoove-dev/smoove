// EQ spectrum — a full-stage, classic mirrored equalizer driven by the real
// sound: 48 log-spaced bands (`bandsAt`), per-band peak caps held over the
// trailing frames (frame-pure — a max over recent `bandsAt` reads, no decaying
// state), and a bass-weighted glow behind it all. Scrub it backwards; it's
// identical every pass.
import { Composition, interpolateColors, Sequence } from "@smoove/core";
import { Audio } from "@smoove/media";
import Konva from "konva";
import musicUrl from "../../files/sound/music-c.mp3";

const FPS = 30;
const TOTAL = 40 * FPS;
const W = 1080;
const H = 1080;

const INK = "#0b1120";
const TEAL = "#2DD4BF";
const GOLD = "#f5c04e";
const MAGENTA = "#e879f9";
const WHITE = "#e2e8f0";
const DIM = "#475569";
const FONT = "Inter, system-ui, sans-serif";

const N_BANDS = 48;
const CAP_HOLD = 12; // frames a peak cap trails behind its band

const comp = new Composition({
  id: "eq-spectrum",
  fps: FPS,
  durationInFrames: TOTAL,
  width: W,
  height: H,
});

const seq = new Sequence({ from: 0, durationInFrames: TOTAL });

const music = new Audio({
  id: "music",
  name: "Music",
  src: musicUrl,
  volume: 0.8,
  introspect: { bands: N_BANDS },
});
seq.add(music);

seq.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: INK, listening: false }));

// Bass-weighted glow behind the bars.
const glow = new Konva.Circle({
  x: W / 2,
  y: H / 2,
  radius: 320,
  fill: TEAL,
  opacity: 0.06,
  listening: false,
});
seq.add(glow);

seq.add(
  new Konva.Text({
    x: 0,
    y: 72,
    width: W,
    align: "center",
    text: "EQ SPECTRUM",
    fontSize: 44,
    fontStyle: "700",
    fontFamily: FONT,
    fill: WHITE,
    letterSpacing: 8,
  }),
  new Konva.Text({
    x: 0,
    y: 130,
    width: W,
    align: "center",
    text: "48 bands · bandsAt(f) · peak caps held 12 frames",
    fontSize: 18,
    fontStyle: "500",
    fontFamily: FONT,
    fill: DIM,
    letterSpacing: 2,
  }),
);

// ---- The mirrored bar field ----
const EQ_X = 70;
const EQ_W = W - 140;
const MID = H / 2 + 60; // mirror line
const MAX_UP = 330; // px of a full-scale band, above the line
const MIRROR = 0.45; // the reflection is squashed
const slotW = EQ_W / N_BANDS;
const barW = slotW * 0.66;

const bars: Konva.Rect[] = [];
const mirrors: Konva.Rect[] = [];
const caps: Konva.Rect[] = [];
for (let k = 0; k < N_BANDS; k++) {
  const x = EQ_X + k * slotW + (slotW - barW) / 2;
  // Bass → treble color sweep across the field.
  const color = interpolateColors(k, [0, N_BANDS / 2, N_BANDS - 1], [TEAL, GOLD, MAGENTA]);
  const bar = new Konva.Rect({
    x,
    y: MID,
    width: barW,
    height: 2,
    fill: color,
    cornerRadius: 2,
    listening: false,
  });
  const mirror = new Konva.Rect({
    x,
    y: MID + 6,
    width: barW,
    height: 2,
    fill: color,
    opacity: 0.22,
    cornerRadius: 2,
    listening: false,
  });
  const cap = new Konva.Rect({
    x,
    y: MID,
    width: barW,
    height: 4,
    fill: WHITE,
    cornerRadius: 2,
    listening: false,
  });
  bars.push(bar);
  mirrors.push(mirror);
  caps.push(cap);
  seq.add(mirror, bar, cap);
}
seq.add(
  new Konva.Line({
    points: [EQ_X, MID + 2, EQ_X + EQ_W, MID + 2],
    stroke: DIM,
    strokeWidth: 1,
    opacity: 0.6,
    listening: false,
  }),
);

// Normalize against the clip's own loudest band, computed once from the table.
let maxBand = 0;
const bandScale = (): number => {
  if (maxBand > 0) return maxBand;
  const env = music.envelope.get();
  if (!env?.bands) return 1;
  for (let i = 0; i < env.bands.length; i++) {
    const v = env.bands[i] as number;
    if (v > maxBand) maxBand = v;
  }
  return maxBand || 1;
};

seq.register((f) => {
  const scale = bandScale() * 0.75;
  const now = music.bandsAt(f);

  // Frame-pure peak caps: the max of each band over the trailing hold window.
  const held = new Float32Array(N_BANDS);
  for (let t = Math.max(0, f - CAP_HOLD); t <= f; t++) {
    const b = t === f ? now : music.bandsAt(t);
    for (let k = 0; k < N_BANDS; k++) {
      const v = (b[k] ?? 0) as number;
      if (v > (held[k] as number)) held[k] = v;
    }
  }

  let bass = 0;
  for (let k = 0; k < N_BANDS; k++) {
    const v = Math.min(1, ((now[k] ?? 0) as number) / Math.max(0.001, scale));
    const hv = Math.min(1, ((held[k] ?? 0) as number) / Math.max(0.001, scale));
    if (k < 8) bass = Math.max(bass, v);

    const h = 2 + MAX_UP * v;
    const bar = bars[k];
    const mirror = mirrors[k];
    const cap = caps[k];
    if (!bar || !mirror || !cap) continue;
    bar.height(h);
    bar.y(MID - h);
    bar.opacity(0.5 + 0.5 * v);
    mirror.height(h * MIRROR);
    cap.y(MID - (2 + MAX_UP * hv) - 8);
    cap.opacity(0.3 + 0.7 * hv);
  }

  glow.radius(300 + 140 * bass);
  glow.opacity(0.04 + 0.1 * bass);
});

comp.add(seq);

export default comp;
