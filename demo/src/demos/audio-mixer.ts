import {
  Audio,
  Composition,
  Easing,
  Sequence,
  interpolate,
  interpolateColors,
} from "@konva-motion/core";
import Konva from "konva";
import musicAUrl from "../files/sound/music-a.mp3";
import musicBUrl from "../files/sound/music-b.mp3";
import voiceUrl from "../files/sound/voice.wav";
import whooshAUrl from "../files/sound/whoosh-a.mp3";
import whooshBUrl from "../files/sound/whoosh-b.mp3";
import type { DemoDef } from "./types.js";

const FPS = 30;
const TOTAL = 780; // 26s

// ---- Timeline anchors (frames @30fps) ----
const VO_FROM = 120; // voice enters
const VO_END = 404; // voice ends (120 + ~284 frames for the 9.48s clip)
const DUCK_IN = 200; // music A fully ducked by here
const DUCK_OUT = 424; // music A restored by here
const XF_FROM = 540; // crossfade begins, music B enters
const XF_END = 630; // crossfade complete (A=0, B=1)
const A_END = 630; // music A sequence ends
const OUT_FROM = 710; // music B outro fade begins
const OUT_END = 770; // music B silent

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
  interpolate(f, [VO_FROM, VO_FROM + 8, VO_END - 8, VO_END], [0, 1, 1, 0], clamp);

const inRange = (f: number, from: number, end: number) => f >= from && f < end;

export const audioMixerDemo: DemoDef = {
  id: "audio-mixer",
  name: "Audio — mixer & ducking",
  build() {
    const SIDE = 1080;
    const comp = new Composition({
      id: "audio-mixer",
      fps: FPS,
      durationInFrames: TOTAL,
      width: SIDE,
      height: SIDE,
    });

    // ===== Audio nodes — each in its own range-gated Sequence =====
    const musicA = new Audio({ id: "music-a", name: "Music A", src: musicAUrl });
    const seqA = new Sequence({ from: 0, durationInFrames: A_END });
    seqA.add(musicA);

    const musicB = new Audio({ id: "music-b", name: "Music B", src: musicBUrl, volume: 0 });
    const seqB = new Sequence({ from: XF_FROM, durationInFrames: TOTAL - XF_FROM });
    seqB.add(musicB);

    const voice = new Audio({ id: "voice", name: "Voice", src: voiceUrl, volume: 0 });
    const seqV = new Sequence({ from: VO_FROM, durationInFrames: VO_END - VO_FROM });
    seqV.add(voice);

    const whooshA = new Audio({ id: "whoosh-a", name: "Whoosh", src: whooshAUrl, volume: 0.5 });
    const seqWA = new Sequence({ from: 108, durationInFrames: 64 });
    seqWA.add(whooshA);

    const whooshB = new Audio({ id: "whoosh-b", name: "Whoosh", src: whooshBUrl, volume: 0.5 });
    const seqWB = new Sequence({ from: XF_FROM - 8, durationInFrames: 130 });
    seqWB.add(whooshB);

    // ===== Visual layer (always on) =====
    const base = new Sequence({ from: 0, durationInFrames: TOTAL });
    base.add(new Konva.Rect({ x: 0, y: 0, width: SIDE, height: SIDE, fill: BG }));

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
    base.add(title, tc);

    // ---- Ring visualizer ----
    const CX = 540;
    const CY = 372;
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
      label: Konva.Text;
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
      return { key, color, label, fill, pct, status };
    };
    strips.push(mkStrip("A", "♪ Music A", GOLD, 648));
    strips.push(mkStrip("B", "♪ Music B", TEAL, 736));
    strips.push(mkStrip("V", "🎙 Voice", WHITE, 824));

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
      const levels: Record<Strip["key"], number> = { A: eA, B: eB, V: eV };

      // Visualizer color blends Music A (gold) → Music B (teal) across the crossfade.
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
        const x1 = CX + cos * INNER;
        const y1 = CY + sin * INNER;
        const x2 = CX + cos * (INNER + len);
        const y2 = CY + sin * (INNER + len);
        const bar = bars[i];
        if (!bar) continue;
        bar.points([x1, y1, x2, y2]);
        bar.stroke(vizColor);
        bar.opacity(0.22 + 0.78 * combined);
      }
      core.stroke(vizColor);
      core.radius(94 + 16 * combined * pulse);
      core.opacity(0.35 + 0.5 * combined);
      coreFill.fill(vizColor);
      coreFill.radius(88 + 14 * combined * pulse);

      // Channel strips.
      for (const s of strips) {
        const lvl = levels[s.key];
        s.fill.width(Math.max(0, lvl * STRIP_W));
        s.fill.fill(masterMuted ? DIM : s.color);
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
      if (frame >= VO_FROM && frame < DUCK_OUT)
        cap = "Automatic ducking — music drops under the voice";
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

    return comp;
  },
};
