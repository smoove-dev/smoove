// Audiogram — the classic podcast-clip card, driven by the real recording via
// `introspect`: a static waveform outline (`waveform`) whose played portion is
// lit by a clip-rect tracking the playhead, and a speaking ring around the
// avatar that breathes with the voice's actual loudness (`rmsAt`) — it goes
// still in the pauses between phrases, which no volume automation can fake.
import { Circle, Composition, Group, Rect, Sequence, Text } from "@smoove/core";
import { Audio } from "@smoove/media";
import voiceUrl from "./assets/voice.wav";

const FPS = 60;
const TOTAL = 9 * FPS; // the voice clip is ~9.5s
const WIDTH = 1920;
const HEIGHT = 1080;

const INK = "#0f172a";
const PANEL = "#111a33";
const ACCENT = "#2DD4BF";
const GOLD = "#f5c04e";
const WHITE = "#e2e8f0";
const DIM = "#64748b";
const FONT = "Inter, system-ui, sans-serif";

const comp = new Composition({
  id: "audiogram",
  fps: FPS,
  durationInFrames: TOTAL,
  width: WIDTH,
  height: HEIGHT,
});

const seq = new Sequence({ from: 0, durationInFrames: TOTAL });

const voice = new Audio({
  id: "voice",
  name: "Voice",
  src: voiceUrl,
  introspect: true,
});
seq.add(voice);

// ===== Card =====
seq.add(new Rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: INK, listening: false }));
seq.add(
  new Rect({
    x: 240,
    y: 180,
    width: WIDTH - 480,
    height: HEIGHT - 360,
    fill: PANEL,
    cornerRadius: 32,
    listening: false,
  }),
);

// ---- Avatar + speaking ring (rmsAt) ----
const AV_X = 560;
const AV_Y = 440;
const speakRing = new Circle({
  x: AV_X,
  y: AV_Y,
  radius: 92,
  stroke: ACCENT,
  strokeWidth: 3,
  opacity: 0.4,
  listening: false,
});
seq.add(
  speakRing,
  new Circle({ x: AV_X, y: AV_Y, radius: 80, fill: "#1e293b", listening: false }),
  new Text({
    x: AV_X - 80,
    y: AV_Y - 24,
    width: 160,
    align: "center",
    text: "SM",
    fontSize: 48,
    fontStyle: "700",
    fontFamily: FONT,
    fill: ACCENT,
    listening: false,
  }),
);

seq.add(
  new Text({
    x: 720,
    y: 390,
    text: "smoove.fm — Ep. 12",
    fontSize: 44,
    fontStyle: "700",
    fontFamily: FONT,
    fill: WHITE,
    listening: false,
  }),
  new Text({
    x: 722,
    y: 452,
    text: "Timelines for the canvas",
    fontSize: 24,
    fontStyle: "500",
    fontFamily: FONT,
    fill: DIM,
    listening: false,
  }),
);

// ---- Waveform with played-portion highlight ----
const WF_X = 360;
const WF_W = WIDTH - 720;
const WF_MID = 690;
const WF_AMP = 66;
const BUCKETS = 128;
const slotW = WF_W / BUCKETS;
const barW = slotW * 0.6;

// Two identical bar fields: a dim base and a bright copy inside a clip group
// whose width follows the playhead — the "played so far" fill.
const makeBars = (fill: string): { group: Group; bars: Rect[] } => {
  const group = new Group({ listening: false });
  const bars: Rect[] = [];
  for (let b = 0; b < BUCKETS; b++) {
    const bar = new Rect({
      x: WF_X + b * slotW + (slotW - barW) / 2,
      y: WF_MID - 1,
      width: barW,
      height: 2,
      fill,
      cornerRadius: 2,
      listening: false,
    });
    bars.push(bar);
    group.add(bar);
  }
  return { group, bars };
};
const base = makeBars("#334155");
const played = makeBars(ACCENT);
played.group.clip({ x: WF_X, y: WF_MID - WF_AMP - 10, width: 0, height: 2 * (WF_AMP + 10) });
seq.add(base.group, played.group);

const playDot = new Circle({
  x: WF_X,
  y: WF_MID + WF_AMP + 38,
  radius: 6,
  fill: GOLD,
  listening: false,
});
const timeText = new Text({
  x: WF_X,
  y: WF_MID + WF_AMP + 28,
  width: WF_W,
  align: "right",
  text: "0:00 / 0:09",
  fontSize: 22,
  fontStyle: "600",
  fontFamily: FONT,
  fill: DIM,
  listening: false,
});
seq.add(playDot, timeText);

// The outline is static — size the bars once when the envelope lands.
let wfBuilt = false;
const buildWaveform = (): void => {
  if (wfBuilt) return;
  const wf = voice.waveform(0, TOTAL, BUCKETS);
  if (wf.max.every((v) => v === 0)) return; // envelope still decoding
  wfBuilt = true;
  // Voice is quiet next to full-scale — normalize to the clip's own peak.
  const top = Math.max(...wf.max, 0.01);
  for (let b = 0; b < BUCKETS; b++) {
    const hi = ((wf.max[b] ?? 0) as number) / top;
    const lo = ((wf.min[b] ?? 0) as number) / top;
    const y = WF_MID - hi * WF_AMP;
    const h = Math.max(2, (hi - lo) * WF_AMP);
    for (const set of [base.bars, played.bars]) {
      const bar = set[b];
      if (!bar) continue;
      bar.y(y);
      bar.height(h);
    }
  }
};

seq.register((f) => {
  buildWaveform();

  // Speaking ring breathes with the actual voice level; still in the pauses.
  const rms = voice.rmsAt(f, { normalized: true });
  speakRing.radius(92 + 26 * rms);
  speakRing.strokeWidth(3 + 7 * rms);
  speakRing.opacity(0.25 + 0.6 * rms);

  // Played-portion fill + dot + timecode follow the playhead.
  const progress = f / TOTAL;
  played.group.clip({
    x: WF_X,
    y: WF_MID - WF_AMP - 10,
    width: WF_W * progress,
    height: 2 * (WF_AMP + 10),
  });
  playDot.x(WF_X + WF_W * progress);
  const secs = Math.floor(f / FPS);
  timeText.setText(`0:${String(secs).padStart(2, "0")} / 0:09`);
});

comp.add(seq);

export default comp;
