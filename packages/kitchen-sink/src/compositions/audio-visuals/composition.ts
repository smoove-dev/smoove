// Audio visuals — everything `introspect` gives you, on one stage:
//   1. an EQ bar spectrum        (bandsAt)
//   2. a static waveform outline (waveform) with a moving playhead
//   3. a VU meter with peak hold (rmsAt / peakAt, normalized)
//   4. a beat pulse              (noveltyAt)
// All four read the clip's real decoded sound, so they scrub backwards and
// render identically on the server.
import { Circle, Composition, Line, Rect, Sequence, Text } from "@smoove/core";
import { Audio } from "@smoove/media";
import musicUrl from "../../files/sound/music-c.mp3";

const FPS = 30;
const TOTAL = 60 * FPS; // 60s of the music track
const W = 1080;
const H = 1080;

const INK = "#0f172a";
const PANEL = "#111832";
const ACCENT = "#2DD4BF"; // teal
const GOLD = "#f5c04e";
const DIM = "#475569";
const WHITE = "#e2e8f0";
const FONT = "Inter, system-ui, sans-serif";

const N_BANDS = 32;

const comp = new Composition({
  id: "audio-visuals",
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

// ===== Static scene =====
seq.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: INK, listening: false }));
seq.add(
  new Text({
    x: 0,
    y: 56,
    width: W,
    align: "center",
    text: "AUDIO VISUALS",
    fontSize: 40,
    fontStyle: "700",
    fontFamily: FONT,
    fill: WHITE,
    letterSpacing: 6,
    listening: false,
  }),
);

const label = (text: string, y: number): Text =>
  new Text({
    x: 90,
    y,
    text,
    fontSize: 18,
    fontStyle: "600",
    fontFamily: FONT,
    fill: DIM,
    letterSpacing: 2,
    listening: false,
  });

// ---- 1. Beat pulse (noveltyAt) ----
const PULSE_CY = 250;
// Glow = radial-gradient disc (mid-stop mimics Gaussian falloff), never
// shadowBlur. Gradient radii live in local coords, so it breathes via scale.
const GLOW_R = 180;
const pulseGlow = new Circle({
  x: W / 2,
  y: PULSE_CY,
  radius: GLOW_R,
  fillRadialGradientStartPoint: { x: 0, y: 0 },
  fillRadialGradientEndPoint: { x: 0, y: 0 },
  fillRadialGradientStartRadius: 0,
  fillRadialGradientEndRadius: GLOW_R,
  fillRadialGradientColorStops: [
    0,
    ACCENT,
    0.28,
    `${ACCENT}66`,
    0.55,
    `${ACCENT}22`,
    1,
    `${ACCENT}00`,
  ],
  listening: false,
});
const pulseCore = new Circle({
  x: W / 2,
  y: PULSE_CY,
  radius: 34,
  stroke: ACCENT,
  strokeWidth: 3,
  listening: false,
});
seq.add(label("BEAT PULSE — noveltyAt(f)", 156), pulseGlow, pulseCore);

// ---- 2. Waveform outline (waveform) + playhead ----
const WF_X = 90;
const WF_W = W - 180;
const WF_MID = 470;
const WF_AMP = 70; // px per full-scale sample
const WF_BUCKETS = 180;
seq.add(label("WAVEFORM — waveform(0, total, buckets)", 372));
seq.add(
  new Rect({
    x: WF_X,
    y: WF_MID - WF_AMP - 8,
    width: WF_W,
    height: 2 * (WF_AMP + 8),
    fill: PANEL,
    cornerRadius: 10,
    listening: false,
  }),
);
const wfShape = new Line({
  points: [],
  closed: true,
  fill: ACCENT,
  opacity: 0.7,
  listening: false,
});
const playhead = new Line({
  points: [WF_X, WF_MID - WF_AMP, WF_X, WF_MID + WF_AMP],
  stroke: GOLD,
  strokeWidth: 2,
  listening: false,
});
seq.add(wfShape, playhead);

// The outline is static: build the polygon once, as soon as the envelope is in.
let wfBuilt = false;
const buildWaveform = (): void => {
  if (wfBuilt) return;
  const wf = music.waveform(0, TOTAL, WF_BUCKETS);
  if (wf.max.every((v) => v === 0)) return; // envelope not decoded yet
  wfBuilt = true;
  const pts: number[] = [];
  const dx = WF_W / WF_BUCKETS;
  // Top edge (max), left → right…
  for (let b = 0; b < WF_BUCKETS; b++) {
    pts.push(WF_X + (b + 0.5) * dx, WF_MID - (wf.max[b] ?? 0) * WF_AMP);
  }
  // …then the bottom edge (min), right → left, closing the polygon.
  for (let b = WF_BUCKETS - 1; b >= 0; b--) {
    pts.push(WF_X + (b + 0.5) * dx, WF_MID - (wf.min[b] ?? 0) * WF_AMP);
  }
  wfShape.points(pts);
};

// ---- 3. VU meter with peak hold (rmsAt / peakAt) ----
const VU_Y = 640;
const VU_X = 90;
const VU_W = W - 180;
const VU_H = 26;
seq.add(label("VU METER — rmsAt(f) · peak hold peakAt(f, { holdFrames: 18 })", VU_Y - 38));
seq.add(
  new Rect({
    x: VU_X,
    y: VU_Y,
    width: VU_W,
    height: VU_H,
    fill: PANEL,
    cornerRadius: 6,
    listening: false,
  }),
);
const vuFill = new Rect({
  x: VU_X,
  y: VU_Y,
  width: 0,
  height: VU_H,
  fill: ACCENT,
  cornerRadius: 6,
  listening: false,
});
const vuHold = new Rect({
  x: VU_X,
  y: VU_Y - 4,
  width: 3,
  height: VU_H + 8,
  fill: GOLD,
  listening: false,
});
seq.add(vuFill, vuHold);

// ---- 4. EQ spectrum (bandsAt) ----
const EQ_BASE = 950;
const EQ_X = 90;
const EQ_W = W - 180;
const EQ_MAX_H = 190;
seq.add(label("SPECTRUM — bandsAt(f), 32 log-spaced bands", EQ_BASE - EQ_MAX_H - 38));
const eqBars: Rect[] = [];
const barW = (EQ_W / N_BANDS) * 0.72;
for (let k = 0; k < N_BANDS; k++) {
  const bar = new Rect({
    x: EQ_X + (k + 0.14) * (EQ_W / N_BANDS),
    y: EQ_BASE,
    width: barW,
    height: 2,
    fill: ACCENT,
    cornerRadius: 3,
    listening: false,
  });
  eqBars.push(bar);
  seq.add(bar);
}

// Scale EQ bars against the clip's own loudest band (computed once from the
// envelope's band table) so the spectrum uses the full height.
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

// ===== Per-frame render — everything reads the real sound =====
seq.register((f) => {
  buildWaveform();

  // Beat pulse: novelty spikes on onsets; rms carries the sustained glow.
  const novelty = music.noveltyAt(f);
  const rms = music.rmsAt(f, { normalized: true });
  pulseCore.radius(34 + 40 * novelty);
  pulseCore.strokeWidth(3 + 5 * novelty);
  const glowScale = (60 + 90 * novelty + 30 * rms) / GLOW_R;
  pulseGlow.scaleX(glowScale);
  pulseGlow.scaleY(glowScale);
  pulseGlow.opacity(0.15 + 0.55 * novelty);

  // Playhead tracks the timeline over the static outline.
  const px = WF_X + (f / TOTAL) * WF_W;
  playhead.points([px, WF_MID - WF_AMP, px, WF_MID + WF_AMP]);

  // VU: bar is current loudness, tick holds the recent peak then decays.
  vuFill.width(VU_W * rms);

  // Stepped hold tick (moves every 10 frames), kept frame-pure: quantize the
  // frame instead of skipping updates, so a seek to any frame shows the same
  // reading playback would.
  const holdFrame = f - (f % 10);
  const hold = music.peakAt(holdFrame, { holdFrames: 10, normalized: true });
  vuHold.x(VU_X + VU_W * hold - 1.5);

  // EQ: one bar per log-spaced band, bass on the left.
  const bands = music.bandsAt(f);
  const scale = bandScale() * 0.7;
  for (let k = 0; k < N_BANDS; k++) {
    const v = Math.min(1, ((bands[k] ?? 0) as number) / Math.max(0.001, scale));
    const h = 2 + EQ_MAX_H * v;
    const bar = eqBars[k];
    if (!bar) continue;
    bar.height(h);
    bar.y(EQ_BASE - h);
    bar.opacity(0.35 + 0.65 * v);
  }
});

comp.add(seq);

export default comp;
