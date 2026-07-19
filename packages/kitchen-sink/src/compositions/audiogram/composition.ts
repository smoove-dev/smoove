// Audiogram — the classic podcast-clip card, driven by the real recording:
// a static waveform outline (`waveform`) with the played portion lit by a
// clip-rect that tracks the playhead, and a speaking ring around the avatar
// that breathes with the voice's actual loudness (`rmsAt`) — it goes still in
// the pauses between phrases, which no volume automation can fake.
import { Circle, Composition, Group, Rect, Sequence, Text } from "@smoove/core";
import { Audio } from "@smoove/media";
import voiceUrl from "../../files/sound/voice.wav";

const FPS = 30;
const TOTAL = 9 * FPS; // the voice clip is ~9.5s
const W = 1080;
const H = 1080;

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
  width: W,
  height: H,
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
seq.add(new Rect({ x: 0, y: 0, width: W, height: H, fill: INK, listening: false }));
seq.add(
  new Rect({
    x: 100,
    y: 230,
    width: W - 200,
    height: 620,
    fill: PANEL,
    cornerRadius: 28,
    listening: false,
  }),
);

// ---- Avatar + speaking ring (rmsAt) ----
const AV_X = W / 2;
const AV_Y = 400;
const speakRing = new Circle({
  x: AV_X,
  y: AV_Y,
  radius: 74,
  stroke: ACCENT,
  strokeWidth: 3,
  opacity: 0.4,
  listening: false,
});
seq.add(
  speakRing,
  new Circle({ x: AV_X, y: AV_Y, radius: 64, fill: "#1e293b", listening: false }),
  new Text({
    x: AV_X - 64,
    y: AV_Y - 20,
    width: 128,
    align: "center",
    text: "SM",
    fontSize: 40,
    fontStyle: "700",
    fontFamily: FONT,
    fill: ACCENT,
    listening: false,
  }),
);

seq.add(
  new Text({
    x: 0,
    y: 512,
    width: W,
    align: "center",
    text: "smoove.fm — Ep. 12",
    fontSize: 34,
    fontStyle: "700",
    fontFamily: FONT,
    fill: WHITE,
    listening: false,
  }),
  new Text({
    x: 0,
    y: 560,
    width: W,
    align: "center",
    text: "Timelines for the canvas",
    fontSize: 20,
    fontStyle: "500",
    fontFamily: FONT,
    fill: DIM,
    listening: false,
  }),
);

// ---- Waveform with played-portion highlight ----
const WF_X = 170;
const WF_W = W - 340;
const WF_MID = 700;
const WF_AMP = 56;
const BUCKETS = 96;
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
  y: WF_MID + WF_AMP + 34,
  radius: 5,
  fill: GOLD,
  listening: false,
});
const timeText = new Text({
  x: WF_X,
  y: WF_MID + WF_AMP + 24,
  width: WF_W,
  align: "right",
  text: "0:00 / 0:09",
  fontSize: 18,
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
  speakRing.radius(74 + 22 * rms);
  speakRing.strokeWidth(3 + 6 * rms);
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
