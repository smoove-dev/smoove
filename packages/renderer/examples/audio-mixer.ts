// Audio-mixer render demo — a port of the demo app's `audio-mixer.ts` that runs
// headlessly through @smoove/renderer using the real sound + video assets
// (copied into ./assets). It exercises the composition mixer end to end:
//
//   • per-channel automation (Music A ducking under the Voice, A→B crossfade)
//   • MASTER fader gestures — a fade-in, a mid dip, a hard MUTE window, a fade-out
//   • a looping Video bed behind the visualizer
//
// The master automation is captured per frame in the audio assets (effective
// volume = master × intrinsic), so it's actually audible in the muxed output.
//
// Run:  pnpm --filter @smoove/renderer example:mixer
//   or: npx tsx examples/audio-mixer.ts [outPath]

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Composition, interpolate, interpolateColors, Sequence } from "@smoove/core";
import { Audio, Video } from "@smoove/media";
import { renderComposition, setupServerRendering } from "@smoove/renderer";
import Konva from "konva";

// Set up server rendering BEFORE building the comp. Cap the video decode so the
// dimmed background bed is decoded small — skia-canvas retains every distinct
// decoded frame, so this keeps memory bounded and the render fast.
setupServerRendering({ videoDecodeCap: { width: 960, height: 540 } });

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "assets");
const sound = (name: string) => join(ASSETS, "sound", name);

const FPS = 30;
const TOTAL = 780; // 26s

// ---- Timeline anchors (frames @30fps) ----
const VO_FROM = 120; // voice enters
const VO_END = 404; // voice ends
const DUCK_IN = 200; // music A fully ducked by here
const DUCK_OUT = 424; // music A restored by here
const XF_FROM = 540; // crossfade begins, music B enters
const XF_END = 630; // crossfade complete (A=0, B=1)
const A_END = 630; // music A sequence ends
const OUT_FROM = 710; // music B outro fade begins
const OUT_END = 770; // music B silent

// ---- Master fader gestures (these drive comp.mixer) ----
const MASTER_IN = 24; // fade master 0 -> 1
const DIP_IN = 250; // master dips...
const DIP_LOW = 290; // ...to its lowest here...
const DIP_OUT = 330; // ...then back to 1
const MUTE_FROM = 468; // hard master mute window
const MUTE_END = 498;

// ---- Palette ----
const BG = "#0b1020";
const INK = "#e6edf3";
const DIM = "#44506b";
const TRACK_BG = "#1b2236";
const GOLD = "#e8b339"; // Music A
const TEAL = "#39c6c0"; // Music B
const WHITE = "#dfe7f5"; // Voice
const GREEN = "#3fb950";
const GREY = "#7d8590";
const RED = "#ff5d5d";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pad2 = (n: number) => String(n).padStart(2, "0");
const timecode = (frame: number) => {
  const ff = frame % FPS;
  const sec = Math.floor(frame / FPS);
  return `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}:${pad2(ff)}`;
};

// Intrinsic (pre-master) channel automation — these ARE the mix.
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
  interpolate(f, [VO_FROM, VO_FROM + 8, VO_END - 8, VO_END], [0, 1, 1, 0], clamp);

// Master fader curve — independent of the channels, scales the whole bus.
const masterVol = (f: number) =>
  interpolate(
    f,
    [0, MASTER_IN, DIP_IN, DIP_LOW, DIP_OUT, OUT_FROM, OUT_END],
    [0, 1, 1, 0.3, 1, 1, 0],
    clamp,
  );

const inRange = (f: number, from: number, end: number) => f >= from && f < end;

function buildComp(): Composition {
  const SIDE = 1080;
  const comp = new Composition({
    id: "audio-mixer",
    fps: FPS,
    durationInFrames: TOTAL,
    width: SIDE,
    height: SIDE,
    mode: "rendering",
  });

  // ===== Audio nodes — each in its own range-gated Sequence =====
  const musicA = new Audio({ id: "music-a", name: "Music A", src: sound("music-a.mp3") });
  const seqA = new Sequence({ durationInFrames: A_END });
  seqA.add(musicA);

  const musicB = new Audio({
    id: "music-b",
    name: "Music B",
    src: sound("music-b.mp3"),
    volume: 0,
  });
  const seqB = new Sequence({ from: XF_FROM, durationInFrames: TOTAL - XF_FROM });
  seqB.add(musicB);

  const voice = new Audio({ id: "voice", name: "Voice", src: sound("voice.wav"), volume: 0 });
  const seqV = new Sequence({ from: VO_FROM, durationInFrames: VO_END - VO_FROM });
  seqV.add(voice);

  const whooshA = new Audio({
    id: "whoosh-a",
    name: "Whoosh",
    src: sound("whoosh-a.mp3"),
    volume: 0.5,
  });
  const seqWA = new Sequence({ from: 108, durationInFrames: 64 });
  seqWA.add(whooshA);

  const whooshB = new Audio({
    id: "whoosh-b",
    name: "Whoosh",
    src: sound("whoosh-b.mp3"),
    volume: 0.5,
  });
  const seqWB = new Sequence({ from: XF_FROM - 8, durationInFrames: 130 });
  seqWB.add(whooshB);

  // ===== Control sequence — added FIRST so automation lands before audio ticks =====
  const control = new Sequence();
  control.register((frame) => {
    // Master fader + a hard mute window — this is the mixer at work.
    comp.mixer.setVolume(masterVol(frame));
    comp.mixer.setMuted(frame >= MUTE_FROM && frame < MUTE_END);
    // Per-channel intrinsic automation.
    musicA.setVolume(volA(frame));
    musicB.setVolume(volB(frame));
    voice.setVolume(volV(frame));
  });

  // ===== Visual layer (always on, added LAST so it reads final values) =====
  const base = new Sequence();

  // Looping film bed behind everything, dimmed by an overlay.
  const film = new Video({
    src: join(ASSETS, "film", "s3c.mp4"),
    width: SIDE,
    height: SIDE,
    objectFit: "cover",
    loop: true,
    muted: true,
  });
  base.add(film);
  base.add(new Konva.Rect({ x: 0, y: 0, width: SIDE, height: SIDE, fill: BG, opacity: 0.82 }));

  const title = new Konva.Text({
    x: 56,
    y: 48,
    text: "AUDIO MIXER",
    fontSize: 40,
    fontStyle: "700",
    letterSpacing: 6,
    fontFamily: "Inter, sans-serif",
    fill: INK,
  });
  const tc = new Konva.Text({
    x: 0,
    y: 54,
    width: SIDE - 56,
    align: "right",
    text: "00:00:00",
    fontSize: 30,
    fontStyle: "600",
    fontFamily: "ui-monospace, monospace",
    fill: GREY,
  });
  // MASTER readout (value + MUTE badge) — the headline mixer state.
  const masterLabel = new Konva.Text({
    x: 56,
    y: 104,
    text: "MASTER 0%",
    fontSize: 26,
    fontStyle: "700",
    fontFamily: "ui-monospace, monospace",
    fill: GREEN,
  });
  const muteBadge = new Konva.Text({
    x: 250,
    y: 104,
    text: "MUTE",
    fontSize: 26,
    fontStyle: "700",
    fontFamily: "ui-monospace, monospace",
    fill: RED,
    visible: false,
  });
  base.add(title, tc, masterLabel, muteBadge);

  // ---- Master meter bar ----
  const M_X = 56;
  const M_Y = 150;
  const M_W = SIDE - 112;
  base.add(
    new Konva.Rect({ x: M_X, y: M_Y, width: M_W, height: 10, cornerRadius: 5, fill: TRACK_BG }),
  );
  const masterBar = new Konva.Rect({
    x: M_X,
    y: M_Y,
    width: 0,
    height: 10,
    cornerRadius: 5,
    fill: GREEN,
  });
  base.add(masterBar);

  // ---- Ring visualizer ----
  const CX = 540;
  const CY = 392;
  const INNER = 118;
  const N = 56;
  const ring = new Konva.Group();
  const bars: Konva.Line[] = [];
  for (let i = 0; i < N; i++) {
    const bar = new Konva.Line({ points: [], stroke: GOLD, strokeWidth: 7, lineCap: "round" });
    bars.push(bar);
    ring.add(bar);
  }
  const core = new Konva.Circle({
    x: CX,
    y: CY,
    radius: 96,
    stroke: GOLD,
    strokeWidth: 3,
    opacity: 0.5,
  });
  const coreFill = new Konva.Circle({ x: CX, y: CY, radius: 90, fill: GOLD, opacity: 0.06 });
  base.add(coreFill, ring, core);

  // ---- Channel strips ----
  type Strip = {
    key: "A" | "B" | "V";
    color: string;
    fill: Konva.Rect;
    pct: Konva.Text;
    status: Konva.Text;
  };
  const STRIP_X = 320;
  const STRIP_W = 600;
  const STRIP_H = 26;
  const strips: Strip[] = [];
  const mkStrip = (key: "A" | "B" | "V", name: string, color: string, y: number): Strip => {
    const label = new Konva.Text({
      x: 56,
      y: y - 6,
      text: name,
      fontSize: 28,
      fontStyle: "600",
      fontFamily: "Inter, sans-serif",
      fill: INK,
    });
    const bg = new Konva.Rect({
      x: STRIP_X,
      y,
      width: STRIP_W,
      height: STRIP_H,
      cornerRadius: 13,
      fill: TRACK_BG,
    });
    const fill = new Konva.Rect({
      x: STRIP_X,
      y,
      width: 0,
      height: STRIP_H,
      cornerRadius: 13,
      fill: color,
    });
    const pct = new Konva.Text({
      x: STRIP_X + STRIP_W + 18,
      y: y - 4,
      text: "0%",
      fontSize: 24,
      fontStyle: "600",
      fontFamily: "ui-monospace, monospace",
      fill: GREY,
    });
    const status = new Konva.Text({
      x: 56,
      y: y + STRIP_H + 6,
      text: "—",
      fontSize: 20,
      fontStyle: "600",
      fontFamily: "Inter, sans-serif",
      fill: DIM,
    });
    base.add(label, bg, fill, pct, status);
    return { key, color, fill, pct, status };
  };
  strips.push(mkStrip("A", "Music A", GOLD, 648));
  strips.push(mkStrip("B", "Music B", TEAL, 736));
  strips.push(mkStrip("V", "Voice", WHITE, 824));

  const caption = new Konva.Text({
    x: 0,
    y: 952,
    width: SIDE,
    align: "center",
    text: "",
    fontSize: 30,
    fontStyle: "600",
    fontFamily: "Inter, sans-serif",
    fill: INK,
  });
  base.add(caption);

  // ===== Per-frame draw (reads the mixer; never mutates it) =====
  base.register((frame) => {
    const master = comp.mixer.volume.get();
    const masterMuted = comp.mixer.muted.get();
    const gate = masterMuted ? 0 : 1;

    const iA = volA(frame);
    const iB = volB(frame);
    const iV = volV(frame);

    const aOn = inRange(frame, 0, A_END);
    const bOn = inRange(frame, XF_FROM, TOTAL);
    const vOn = inRange(frame, VO_FROM, VO_END);

    // Effective levels = intrinsic × master × mute-gate (what you actually hear).
    const eA = (aOn ? iA : 0) * master * gate;
    const eB = (bOn ? iB : 0) * master * gate;
    const eV = (vOn ? iV : 0) * master * gate;
    const levels: Record<Strip["key"], number> = { A: eA, B: eB, V: eV };

    // Master readout + meter.
    masterLabel.text(`MASTER ${Math.round(master * 100)}%`);
    masterLabel.fill(masterMuted ? RED : GREEN);
    masterBar.width(Math.max(0, master * M_W));
    masterBar.fill(masterMuted ? RED : GREEN);
    muteBadge.visible(masterMuted);

    const vizColor = interpolateColors(
      frame,
      [0, XF_FROM, XF_END, TOTAL],
      [GOLD, GOLD, TEAL, TEAL],
    );
    const combined = Math.max(eA, eB, eV * 0.85);
    const pulse = 1 + 0.12 * Math.sin(frame * 0.4);

    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const osc = 0.32 + 0.68 * Math.abs(Math.sin(frame * 0.22 + i * 0.55));
      const len = 14 + 120 * combined * osc * pulse;
      const bar = bars[i];
      if (!bar) continue;
      bar.points([
        CX + cos * INNER,
        CY + sin * INNER,
        CX + cos * (INNER + len),
        CY + sin * (INNER + len),
      ]);
      bar.stroke(vizColor);
      bar.opacity(0.22 + 0.78 * combined);
    }
    core.stroke(vizColor);
    core.radius(94 + 16 * combined * pulse);
    core.opacity(0.35 + 0.5 * combined);
    coreFill.fill(vizColor);
    coreFill.radius(88 + 14 * combined * pulse);

    for (const s of strips) {
      const lvl = levels[s.key];
      s.fill.width(Math.max(0, lvl * STRIP_W));
      s.fill.fill(masterMuted ? DIM : s.color);
      s.pct.text(`${Math.round(lvl * 100)}%`);
      const on = s.key === "A" ? aOn : s.key === "B" ? bOn : vOn;
      let text = "—";
      let color = DIM;
      if (masterMuted && on) {
        text = "muted";
        color = RED;
      } else if (on) {
        if (s.key === "A" && iA < 0.9) {
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

    let cap = "Beat-synced visuals";
    if (frame < MASTER_IN) cap = "Master fader — easing in";
    else if (frame >= MUTE_FROM && frame < MUTE_END) cap = "MASTER MUTE — whole bus silenced";
    else if (frame >= DIP_IN && frame < DIP_OUT) cap = "Master dip — everything ducks together";
    else if (frame >= VO_FROM && frame < DUCK_OUT)
      cap = "Channel ducking — music drops under the voice";
    else if (frame >= XF_FROM && frame < XF_END) cap = "Crossfade — Music A → Music B";
    else if (frame >= OUT_FROM) cap = "Master fade-out";
    caption.text(cap);

    tc.text(timecode(frame));
  });

  // Control first, audio next, visuals last.
  comp.add(control, seqA, seqB, seqV, seqWA, seqWB, base);
  return comp;
}

async function main(): Promise<void> {
  const out = process.argv[2] ?? join(process.cwd(), "audio-mixer.mp4");
  const result = await renderComposition(buildComp(), {
    output: out,
    quality: "medium",
    onProgress: (p) => {
      if (p.frame % 30 === 0 || p.frame === p.total) {
        process.stdout.write(`  ${p.frame}/${p.total} @ ${p.fps.toFixed(1)} fps\r`);
      }
    },
  });
  console.log("\ndone:", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
