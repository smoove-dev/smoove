import { Composition, interpolate, interpolateColors, Sequence } from "@smoove/core";
import { Audio } from "@smoove/media";
import Konva from "konva";
import musicAUrl from "./assets/music-a.mp3";
import musicBUrl from "./assets/music-b.mp3";
import voiceUrl from "./assets/voice.wav";
import whooshAUrl from "./assets/whoosh-a.mp3";
import whooshBUrl from "./assets/whoosh-b.mp3";

const FPS = 60;
const TOTAL = FPS * 26;

// ---- Timeline anchors (frames @60fps) ----
const VO_FROM = 240; // voice enters
const VO_END = 808; // voice ends (240 + ~568 frames for the 9.48s clip)
const DUCK_IN = 400; // music A fully ducked by here
const DUCK_OUT = 848; // music A restored by here
const XF_FROM = 1080; // crossfade begins, music B enters
const XF_END = 1260; // crossfade complete (A=0, B=1)
const A_END = 1260; // music A sequence ends
const OUT_FROM = 1420; // music B outro fade begins
const OUT_END = 1540; // music B silent

// ---- Palette ----
const BG = "#0d1117";
const INK = "#f9fafb";
const MUTED = "#9aa5b1";
const DIM = "#5a6684";
const TRACK_BG = "#1a2236";
const GOLD = "#e8b339"; // Music A
const CYAN = "#4cc9f0"; // Music B
const MAG = "#b5179e"; // Voice
const GREEN = "#3fb950";
const GREY = "#7d8590";

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const sans = "Inter, ui-sans-serif, system-ui, sans-serif";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pad2 = (n: number) => String(n).padStart(2, "0");
const timecode = (frame: number) => {
  const ff = frame % FPS;
  const sec = Math.floor(frame / FPS);
  return `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}:${pad2(ff)}`;
};

// Intrinsic (pre-master) automation curves — these ARE the mix.
const volA = (f: number) =>
  interpolate(
    f,
    [0, VO_FROM, DUCK_IN, VO_END, DUCK_OUT, XF_FROM, XF_END],
    [1, 1, 0.25, 0.25, 1, 1, 0],
    clamp,
  );
const volB = (f: number) =>
  interpolate(f, [XF_FROM, XF_END, OUT_FROM, OUT_END], [0, 1, 1, 0], clamp);
const volV = (f: number) =>
  interpolate(f, [VO_FROM, VO_FROM + 16, VO_END - 16, VO_END], [0, 1, 1, 0], clamp);

const inRange = (f: number, from: number, end: number) => f >= from && f < end;

// 16:9 canvas — fills the player's demo area without letterboxing.
const WIDTH = 1920;
const HEIGHT = 1080;
const comp = new Composition({
  id: "audio-mixer",
  fps: FPS,
  durationInFrames: TOTAL,
  width: WIDTH,
  height: HEIGHT,
});

// ===== Audio nodes — each in its own range-gated Sequence =====
const musicA = new Audio({ id: "music-a", name: "Music A", src: musicAUrl });
const seqA = new Sequence({ durationInFrames: A_END });
seqA.add(musicA);

const musicB = new Audio({ id: "music-b", name: "Music B", src: musicBUrl, volume: 0 });
const seqB = new Sequence({ from: XF_FROM, durationInFrames: TOTAL - XF_FROM });
seqB.add(musicB);

const voice = new Audio({ id: "voice", name: "Voice", src: voiceUrl, volume: 0 });
const seqV = new Sequence({ from: VO_FROM, durationInFrames: VO_END - VO_FROM });
seqV.add(voice);

const whooshA = new Audio({ id: "whoosh-a", name: "Whoosh", src: whooshAUrl, volume: 0.5 });
const seqWA = new Sequence({ from: 216, durationInFrames: 128 });
seqWA.add(whooshA);

const whooshB = new Audio({ id: "whoosh-b", name: "Whoosh", src: whooshBUrl, volume: 0.5 });
const seqWB = new Sequence({ from: XF_FROM - 16, durationInFrames: 260 });
seqWB.add(whooshB);

// ===== Visual layer (always on) =====
const base = new Sequence();
base.add(new Konva.Rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: BG }));

// ---- Header ----
const title = new Konva.Text({
  x: 72,
  y: 56,
  text: "AUDIO MIXER",
  fontSize: 46,
  fontStyle: "700",
  letterSpacing: 8,
  fontFamily: sans,
  fill: INK,
});
const subtitle = new Konva.Text({
  x: 74,
  y: 120,
  text: "Frame-driven mix · ducking · crossfade",
  fontSize: 24,
  fontStyle: "500",
  fontFamily: sans,
  fill: MUTED,
});
const tc = new Konva.Text({
  x: 0,
  y: 66,
  width: WIDTH - 72,
  align: "right",
  text: "00:00:00",
  fontSize: 36,
  fontStyle: "600",
  letterSpacing: 2,
  fontFamily: mono,
  fill: GREY,
});
base.add(title, subtitle, tc);

// ---- Equalizer spectrum — rounded pill bars mirrored around a midline. ----
const N = 48;
const BAR_W = 20;
const GAP = 14;
const SPAN = N * BAR_W + (N - 1) * GAP;
const EQ_X = (WIDTH - SPAN) / 2;
const MID_Y = 430;
const MAX_H = 320;
const MIN_H = 14;

const eqBars: Konva.Rect[] = [];
for (let i = 0; i < N; i++) {
  const bar = new Konva.Rect({
    x: EQ_X + i * (BAR_W + GAP),
    y: MID_Y - MIN_H / 2,
    width: BAR_W,
    height: MIN_H,
    cornerRadius: BAR_W / 2,
    fill: GOLD,
  });
  eqBars.push(bar);
  base.add(bar);
}

// ---- Channel strips — horizontal level bars. ----
type StripKey = "A" | "B" | "V";
type Strip = {
  key: StripKey;
  color: string;
  dot: Konva.Circle;
  fill: Konva.Rect;
  pct: Konva.Text;
  status: Konva.Text;
};
const BAR_X = 430;
const BAR_LEN = 1040;
const BAR_H = 22;
const strips: Strip[] = [];
const mkStrip = (key: StripKey, name: string, color: string, y: number): Strip => {
  const dot = new Konva.Circle({ x: 188, y: y + BAR_H / 2, radius: 9, fill: color });
  const label = new Konva.Text({
    x: 212,
    y: y - 5,
    text: name,
    fontSize: 27,
    fontStyle: "600",
    fontFamily: sans,
    fill: INK,
  });
  const track = new Konva.Rect({
    x: BAR_X,
    y,
    width: BAR_LEN,
    height: BAR_H,
    cornerRadius: BAR_H / 2,
    fill: TRACK_BG,
  });
  const fill = new Konva.Rect({
    x: BAR_X,
    y,
    width: 0,
    height: BAR_H,
    cornerRadius: BAR_H / 2,
    fill: color,
  });
  const pct = new Konva.Text({
    x: BAR_X + BAR_LEN + 28,
    y: y - 3,
    text: "0%",
    fontSize: 25,
    fontStyle: "600",
    fontFamily: mono,
    fill: GREY,
  });
  const status = new Konva.Text({
    x: BAR_X + BAR_LEN + 150,
    y: y - 1,
    text: "—",
    fontSize: 23,
    fontStyle: "600",
    fontFamily: sans,
    fill: DIM,
  });
  base.add(dot, label, track, fill, pct, status);
  return { key, color, dot, fill, pct, status };
};
strips.push(mkStrip("A", "Music A", GOLD, 660));
strips.push(mkStrip("B", "Music B", CYAN, 744));
strips.push(mkStrip("V", "Voice", MAG, 828));

const caption = new Konva.Text({
  x: 0,
  y: 960,
  width: WIDTH,
  align: "center",
  text: "",
  fontSize: 32,
  fontStyle: "600",
  fontFamily: sans,
  fill: INK,
});
base.add(caption);

// ===== Per-frame render =====
const render = (frame: number, playing: boolean) => {
  const master = comp.mixer.volume.get();
  const masterMuted = comp.mixer.muted.get();
  const gate = masterMuted ? 0 : 1;

  // Intrinsic levels (also push to the sources so scrubbing stays in sync).
  const iA = volA(frame);
  const iB = volB(frame);
  const iV = volV(frame);
  musicA.setVolume(iA);
  musicB.setVolume(iB);
  voice.setVolume(iV);

  const aOn = inRange(frame, 0, A_END);
  const bOn = inRange(frame, XF_FROM, TOTAL);
  const vOn = inRange(frame, VO_FROM, VO_END);

  // Effective levels = intrinsic × master (what you'd actually hear).
  const eA = (aOn ? iA : 0) * master * gate;
  const eB = (bOn ? iB : 0) * master * gate;
  const eV = (vOn ? iV : 0) * master * gate;
  const levels: Record<StripKey, number> = { A: eA, B: eB, V: eV };

  // Spectrum color blends Music A (gold) → Music B (cyan) across the crossfade.
  const vizColor = interpolateColors(frame, [0, XF_FROM, XF_END, TOTAL], [GOLD, GOLD, CYAN, CYAN]);
  const combined = Math.max(eA, eB, eV * 0.9);
  const pulse = 1 + 0.08 * Math.sin(frame * 0.18);

  for (let i = 0; i < N; i++) {
    const bar = eqBars[i];
    if (!bar) continue;
    // Bell envelope: tall in the middle, short at the edges.
    const envelope = 0.4 + 0.6 * Math.sin((Math.PI * (i + 0.5)) / N);
    const osc = 0.45 + 0.55 * Math.abs(Math.sin(frame * 0.12 + i * 0.42));
    const h = Math.min(MAX_H, MIN_H + (MAX_H - MIN_H) * combined * envelope * osc * pulse);
    bar.height(h);
    bar.y(MID_Y - h / 2);
    bar.fill(vizColor);
    bar.opacity(0.45 + 0.55 * envelope);
  }

  // Channel strips.
  for (const s of strips) {
    const lvl = Math.max(0, Math.min(1, levels[s.key]));
    const w = lvl * BAR_LEN;
    s.fill.width(w);
    s.fill.cornerRadius(Math.min(BAR_H / 2, w / 2));
    s.fill.fill(masterMuted ? DIM : s.color);
    s.dot.fill(lvl > 0.02 ? s.color : DIM);
    s.pct.text(`${Math.round(lvl * 100)}%`);

    const on = s.key === "A" ? aOn : s.key === "B" ? bOn : vOn;
    let text = "—";
    let color = DIM;
    if (on) {
      if (!playing) {
        text = "paused";
        color = GREY;
      } else if (s.key === "A" && iA < 0.9) {
        text = "ducked";
        color = GOLD;
      } else {
        text = "playing";
        color = GREEN;
      }
    }
    s.status.text(text);
    s.status.fill(color);
  }

  // Caption per phase.
  let cap = "Beat-synced visuals";
  if (frame >= VO_FROM && frame < DUCK_OUT) cap = "Automatic ducking — music drops under the voice";
  else if (frame >= XF_FROM && frame < XF_END) cap = "Crossfade & mix — Music A → Music B";
  else if (frame >= XF_END) cap = "Mixing two beds";
  caption.text(cap);

  tc.text(timecode(frame));
};

// Audio sequences first (no visuals), base layer on top.
comp.add(seqA, seqB, seqV, seqWA, seqWB, base);

base.register((frame) => render(frame, comp.isPlaying.get()));
render(0, false);

// Refresh when play/pause toggles or the master changes without a frame change.
const redraw = () => {
  render(comp.frame.get(), comp.isPlaying.get());
  base.batchDraw();
};
comp.isPlaying.subscribe(redraw);
comp.mixer.volume.subscribe(redraw);
comp.mixer.muted.subscribe(redraw);

export default comp;
