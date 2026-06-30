import {
  Audio,
  Block,
  Composition,
  Easing,
  Sequence,
  type ShadowProps,
  Video,
  interpolate,
} from "@smoove/core";
import Konva from "konva";
import vo1Url from "../../files/film/VO1.wav";
import vo2Url from "../../files/film/VO2.wav";
import vo3Url from "../../files/film/VO3.wav";
import vo4Url from "../../files/film/VO4.wav";
import s1Music from "../../files/film/s1-audio.mp3";
import s1aUrl from "../../files/film/s1a.mp4";
import s1bUrl from "../../files/film/s1b.mp4";
import s1cUrl from "../../files/film/s1c.mp4";
import s2Music from "../../files/film/s2-audio.mp3";
import s2aUrl from "../../files/film/s2a.mp4";
import s2bUrl from "../../files/film/s2b.mp4";
import s2cUrl from "../../files/film/s2c.mp4";
import s3aUrl from "../../files/film/s3a.mp4";
import s3bUrl from "../../files/film/s3b.mp4";
import s3cUrl from "../../files/film/s3c.mp4";
import s4Music from "../../files/film/s4-audio.mp3";
import s4aUrl from "../../files/film/s4a.mp4";
import s4bUrl from "../../files/film/s4b.mp4";
import s4cUrl from "../../files/film/s4c.mp4";
import whooshAUrl from "../../files/film/whoosh-a.mp3";
import whooshBUrl from "../../files/film/whoosh-b.mp3";
import type { CohabitProps } from "./schema.js";

const FPS = 30;
const W = 1920;
const H = 1080;

const sec = (s: number) => Math.round(s * FPS);

// Brand.
const ACCENT = "#2DD4BF"; // calm teal
const ACCENT_DARK = "#0d9488";
const INK = "#0f172a";
const WHITE = "#ffffff";
const FONT = "Inter, system-ui, sans-serif";

// Lower-third safe zone.
const SAFE_X = 150;
const LT_Y = Math.round(H * 0.72);

// ── Timeline (frames) ──────────────────────────────────────────────────────
// Cold open — no intro. Scene 1 starts on frame 0.
// Scene 1 — 8s, three clips
const S1A = 0; // 0
const S1B = S1A + sec(2.67); // 80
const S1C = S1B + sec(2.67); // 160
const S1_END = sec(8); // 240
// Scene 2 — 8s
const S2A = S1_END; // 240
const S2B = S2A + sec(2.67); // 320
const S2C = S2B + sec(2.67); // 400
const S2_END = sec(16); // 480
// Scene 3 — 8s, faster cuts
const S3A = S2_END; // 480
const S3B = S3A + sec(2.67); // 560
const S3C = S3B + sec(2.67); // 640
const S3_END = sec(24); // 720
// Scene 4 + outro — ~10s (the relocated logo reveal lands on s4c)
const S4A = S3_END; // 720
const S4B = S4A + sec(2.5); // 795
const S4C = S4B + sec(2.5); // 870
const TOTAL = S4C + sec(5); // 1020 — 1.5s logo reveal + 2s hold + 1.5s fade

// ── Audio levels ─────────────────────────────────────────────────────────
// dB → linear gain. The brief specs everything in dB; convert once here.
const db = (d: number) => 10 ** (d / 20);
const CLIP_18 = db(-2); // s1/s4 clip audio — room-tone texture only
const CLIP_12 = db(-4); // s3 clip audio — good-vibe chatter sells the energy
const DUCK_6 = db(-6); // anything under a live VO line
const DUCK_3 = db(-3); // music dip so the big whoosh-a hit lands
const MUSIC_BASE = 0.75; // music bed nominal level (pre-duck)

// VO windows (global frames). Sized from the real clip lengths.
const VO = {
  v1: { from: 15, to: 15 + sec(6.44) }, // over s1a/s1b
  v2: { from: 325, to: 325 + sec(4.24) }, // over s2b/s2c
  v3: { from: 500, to: 500 + sec(6.48) }, // across scene 3
  v4: { from: 792, to: 792 + sec(4.16) }, // over s4b
} as const;

const voActive = (f: number) => Object.values(VO).some((w) => f >= w.from && f < w.to);
/** −6 dB under any live VO line. */
const voDuck = (f: number) => (voActive(f) ? DUCK_3 : 1);
/** Music also dips −3 dB across the whoosh-a peak on the s1c→s2a hit. */
const whooshDip = (f: number) =>
  interpolate(f, [S2A - 8, S2A - 2, S2A + 10], [1, DUCK_3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
const musicDuck = (f: number) => Math.min(voDuck(f), whooshDip(f));

const easeOut = Easing.out(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);
const easeBack = Easing.out(Easing.back(1.6));

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Fade + rise: enters fading up from `rise`px below, exits fading out. */
function fadeRise(
  f: number,
  inStart: number,
  outStart: number,
  opts: { dur?: number; rise?: number } = {},
): { alpha: number; dy: number } {
  const dur = opts.dur ?? 12; // ~0.4s @30fps
  const rise = opts.rise ?? 8;
  const e = easeOut(clamp01((f - inStart) / dur));
  const tOut = clamp01((f - outStart) / dur);
  return { alpha: e * (1 - tOut), dy: (1 - e) * rise };
}

// ── Color grade overlays ─────────────────────────────────────────────────
type Grade = "cool" | "warm" | "bright" | "none";

/** Stack tint/desaturation rects on top of a clip to set its grade. */
function applyGrade(seq: Sequence, grade: Grade): void {
  const add = (fill: string, opacity: number, gco?: GlobalCompositeOperation) => {
    const r = new Konva.Rect({
      x: 0,
      y: 0,
      width: W,
      height: H,
      fill,
      opacity,
      listening: false,
    });
    if (gco) r.globalCompositeOperation(gco);
    seq.add(r);
    return r;
  };
  if (grade === "cool") {
    // The "before": desaturate, then cool it down.
    add("#8a8f99", 0.38, "saturation");
    add("#1b2a4a", 0.26);
  } else if (grade === "warm") {
    add("#ff9a3c", 0.16);
    add("#fff4d6", 0.06);
  } else if (grade === "bright") {
    add("#ffffff", 0.08);
    add("#d9fbf4", 0.05);
  }
}

// ── Clip helper ────────────────────────────────────────────────────────────
type ClipOpts = {
  from: number;
  to: number;
  src: string;
  name: string;
  grade: Grade;
  /** Crossfade-in over N frames (used when overlapping the previous clip). */
  fadeIn?: number;
  fadeOut?: number;
  /** Slow push-in for a touch of life. */
  kenBurns?: boolean;
  /** Original clip-audio level (linear). Omit → muted. Ducks −6 dB under VO. */
  clipVol?: number;
};

function addClip(comp: Composition<CohabitProps>, o: ClipOpts): Sequence {
  const dur = o.to - o.from;
  const seq = new Sequence({ from: o.from, durationInFrames: dur });

  const muted = o.clipVol === undefined;
  const group = new Konva.Group({ x: 0, y: 0 });
  const video = new Video({
    src: o.src,
    name: o.name,
    x: 0,
    y: 0,
    width: W,
    height: H,
    objectFit: "cover",
    objectPosition: "center",
    muted,
    volume: o.clipVol ?? 0,
  });
  group.add(video);
  seq.add(group);

  applyGrade(seq, o.grade);

  seq.register((f) => {
    let alpha = 1;
    if (o.fadeIn) {
      alpha *= clamp01(f / o.fadeIn);
    }
    if (o.fadeOut) {
      alpha *= clamp01((dur - f) / o.fadeOut);
    }
    seq.opacity(alpha);

    // Clip audio is background texture — duck it whenever a VO line speaks.
    if (!muted) video.setVolume((o.clipVol ?? 0) * voDuck(o.from + f));

    if (o.kenBurns) {
      const s = interpolate(f, [0, dur], [1.06, 1.14], { easing: easeInOut });
      group.scaleX(s);
      group.scaleY(s);
      group.offsetX((W * (s - 1)) / 2 / s);
      group.offsetY((H * (s - 1)) / 2 / s);
    }
  });

  comp.add(seq);
  return seq;
}

// ── Audio helpers ──────────────────────────────────────────────────────────
/** A music stem with per-frame volume automation (crossfades + ducking). */
function addMusic(
  comp: Composition<CohabitProps>,
  o: {
    src: string;
    name: string;
    from: number;
    to: number;
    trimBefore?: number;
    curve: (g: number) => number;
  },
): void {
  const seq = new Sequence({ from: o.from, durationInFrames: o.to - o.from });
  const music = new Audio({
    id: o.name,
    name: o.name,
    src: o.src,
    trimBefore: o.trimBefore,
    volume: 0,
  });
  seq.add(music);
  seq.register((f) => {
    const g = o.from + f;
    music.setVolume(o.curve(g) * musicDuck(g));
  });
  comp.add(seq);
}

/** A one-shot SFX hit at a fixed level. */
function addSfx(
  comp: Composition<CohabitProps>,
  o: { src: string; name: string; from: number; dur: number; volume: number },
): void {
  const seq = new Sequence({ from: o.from, durationInFrames: o.dur });
  seq.add(new Audio({ id: `${o.name}-${o.from}`, name: o.name, src: o.src, volume: o.volume }));
  comp.add(seq);
}

/** A voiceover line — top of the mix, with short fades at its edges. */
function addVo(
  comp: Composition<CohabitProps>,
  o: { src: string; name: string; from: number; to: number },
): void {
  const dur = o.to - o.from;
  const seq = new Sequence({ from: o.from, durationInFrames: dur });
  const vo = new Audio({ id: o.name, name: o.name, src: o.src, volume: 0 });
  seq.add(vo);
  seq.register((f) => {
    vo.setVolume(
      interpolate(f, [0, 5, dur - 8, dur], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  });
  comp.add(seq);
}

// ── Text helpers ─────────────────────────────────────────────────────────
/** A lower-third headline that fades + rises in, holds, fades out. */
function addCaption(
  seq: Sequence,
  text: string,
  inStart: number,
  outStart: number,
  opts: { size?: number; weight?: string; y?: number; width?: number; color?: string } = {},
): void {
  const node = new Konva.Text({
    x: SAFE_X,
    y: opts.y ?? LT_Y,
    width: opts.width ?? Math.round(W * 0.62),
    text,
    fontFamily: FONT,
    fontSize: opts.size ?? 60,
    fontStyle: opts.weight ?? "700",
    fill: opts.color ?? WHITE,
    lineHeight: 1.15,
    shadowColor: "#000",
    shadowBlur: 24,
    shadowOpacity: 0.35,
    shadowOffset: { x: 0, y: 2 },
    opacity: 0,
  });
  const baseY = node.y();
  seq.add(node);
  seq.register((f) => {
    const { alpha, dy } = fadeRise(f, inStart, outStart);
    node.opacity(alpha);
    node.y(baseY + dy);
  });
}

/**
 * A "bubble": a single core `Block` whose background hugs (or, with `width`,
 * wraps) a `Konva.Text` child — CSS-style text + box in one element. The Block
 * lays itself out each frame once added to a Sequence, so the background tracks
 * the wrapped text automatically.
 */
function makeBubble(
  text: string,
  opts: {
    fontSize?: number;
    weight?: string;
    color?: string;
    background?: string;
    width?: number;
    padX?: number;
    padY?: number;
    lineHeight?: number;
    cornerRadius?: number | number[];
    shadow?: ShadowProps;
  } = {},
): Block {
  const padX = opts.padX ?? 30;
  const padY = opts.padY ?? 20;
  const txt = new Konva.Text({
    text,
    fontFamily: FONT,
    fontSize: opts.fontSize ?? 34,
    fontStyle: opts.weight ?? "500",
    fill: opts.color ?? "#5b6472",
    lineHeight: opts.lineHeight ?? 1.2,
  });
  // Column direction routes the text through the engine's wrap path (text gets
  // width:100% of the content box). With an explicit `width` the text wraps to
  // it and the Block height hugs the wrapped lines; without one, hug the text's
  // natural single-line width (+epsilon avoids an off-by-one re-wrap).
  const width = opts.width ?? Math.ceil(txt.width()) + padX * 2 + 2;
  const bubble = new Block({
    width,
    flexDirection: "column",
    padding: [padY, padX],
    background: opts.background,
    cornerRadius: opts.cornerRadius,
    shadow: opts.shadow,
  });
  bubble.add(txt);
  return bubble;
}

/** A rounded accent "chip" with white text, sized to its label. */
function makeChip(label: string, size = 44): { group: Block; width: number } {
  const padX = 40;
  const padY = 24;
  const group = makeBubble(label, {
    fontSize: size,
    weight: "600",
    color: WHITE,
    background: ACCENT,
    padX,
    padY,
    cornerRadius: (size + padY * 2) / 2,
    shadow: { color: ACCENT_DARK, blur: 30, opacity: 0.5, offsetY: 10 },
  });
  return { group, width: group.width() };
}

// ── Logo (typographic wordmark + simple building mark) ─────────────────────
/**
 * Returns a centered group (origin (0,0) at center) plus its recolorable nodes
 * so callers can live-update the accent (mark) and word color from props.
 */
function makeLogo(
  scale = 1,
  wordColor: string = INK,
  accent: string = ACCENT,
): { group: Konva.Group; mark: Konva.Rect; word: Konva.Text } {
  const g = new Konva.Group();

  const markSize = 84 * scale;
  // Rounded accent square with two "windows" → suggests a building.
  const mark = new Konva.Rect({
    x: 0,
    y: 0,
    width: markSize,
    height: markSize,
    cornerRadius: markSize * 0.26,
    fill: accent,
  });
  const winW = markSize * 0.16;
  const winH = markSize * 0.16;
  const gap = markSize * 0.12;
  const startX = markSize / 2 - (winW * 2 + gap) / 2;
  const startY = markSize * 0.26;
  const windows: Konva.Rect[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      windows.push(
        new Konva.Rect({
          x: startX + c * (winW + gap),
          y: startY + r * (winH + gap),
          width: winW,
          height: winH,
          cornerRadius: winW * 0.3,
          fill: WHITE,
          opacity: 0.92,
        }),
      );
    }
  }
  // door
  const door = new Konva.Rect({
    x: markSize / 2 - winW * 0.55,
    y: startY + 2 * (winH + gap),
    width: winW * 1.1,
    height: markSize * 0.22,
    cornerRadius: [winW * 0.3, winW * 0.3, 0, 0],
    fill: WHITE,
    opacity: 0.92,
  });

  const word = new Konva.Text({
    text: "Cohabit",
    fontFamily: FONT,
    fontSize: 76 * scale,
    fontStyle: "700",
    fill: wordColor,
    letterSpacing: -1,
  });
  // Layout: mark + gap + word, vertically centered on the mark.
  const wordGap = 28 * scale;
  word.x(markSize + wordGap);
  word.y(markSize / 2 - word.height() / 2);

  g.add(mark, ...windows, door, word);

  const totalW = markSize + wordGap + word.width();
  const totalH = markSize;
  // Center the group's origin so callers can scale around the middle.
  g.offsetX(totalW / 2);
  g.offsetY(totalH / 2);
  return { group: g, mark, word };
}

// ── Build ──────────────────────────────────────────────────────────────────
/**
 * Cohabit — a four-scene branded promo with graded video, a layered audio mix
 * (music stems + voiceover + SFX) and a prop-driven end card. Reads its props
 * signal live: the studio re-renders the current frame whenever props change,
 * so updaters just read `p()`.
 */
const comp = new Composition<CohabitProps>({
  id: "cohabit",
  fps: FPS,
  durationInFrames: TOTAL,
  width: W,
  height: H,
  loop: true,
  props: {
    accent: ACCENT,
    appName: "Cohabit",
    headline: "Managing a building\nshouldn't feel like this.",
    bubbleSize: 34,
    bubbles: [
      { text: "Dues?", wide: false },
      { text: "Leak again", wide: false },
      { text: "Meeting?", wide: false },
      { text: "Who's paying for\nthe plumber?", wide: true },
    ],
    logoWord: "ink",
    endCard: {
      tagline: "Your building, handled.",
      ctaLabel: "Start free →",
      ctaColor: ACCENT,
      showAccentLine: true,
    },
  },
});
const p = () => comp.props.get();

// ── Scene 1 — The Problem (cool, desaturated "before") ──
// Clip audio kept at −18 dB: ambient texture under VO + music.
addClip(comp, {
  from: S1A,
  to: S1B,
  src: s1aUrl,
  name: "s1a",
  grade: "cool",
  kenBurns: true,
  clipVol: CLIP_18,
});
const s1bSeq = addClip(comp, {
  from: S1B,
  to: S1C,
  src: s1bUrl,
  name: "s1b",
  grade: "cool",
  clipVol: CLIP_18,
});
addClip(comp, {
  from: S1C,
  to: S1_END,
  src: s1cUrl,
  name: "s1c",
  grade: "cool",
  clipVol: CLIP_18,
});

// s1a headline — text is prop-driven (multiline).
{
  const seq = new Sequence({ from: S1A, durationInFrames: S1B - S1A });
  const outStart = S1B - S1A - 16;
  const node = new Konva.Text({
    x: SAFE_X,
    y: Math.round(H * 0.62),
    width: Math.round(W * 0.62),
    text: p().headline,
    fontFamily: FONT,
    fontSize: 64,
    fontStyle: "700",
    fill: WHITE,
    lineHeight: 1.15,
    shadowColor: "#000",
    shadowBlur: 24,
    shadowOpacity: 0.35,
    shadowOffset: { x: 0, y: 2 },
    opacity: 0,
  });
  const baseY = node.y();
  seq.add(node);
  seq.register((f) => {
    node.text(p().headline);
    const { alpha, dy } = fadeRise(f, 20, outStart);
    node.opacity(alpha);
    node.y(baseY + dy);
  });
  comp.add(seq);
}

// s1b overwhelm: floating chat bubbles drifting up + fading. The set is
// prop-driven (array of objects) — bubbles rebuild when the array changes,
// and animate from anchor positions staggered by index.
{
  const dur = S1C - S1B;
  const ANCHORS = [
    { x: 0.18, y: 0.55 },
    { x: 0.36, y: 0.68 },
    { x: 0.6, y: 0.5 },
    { x: 0.46, y: 0.82 },
    { x: 0.7, y: 0.64 },
    { x: 0.24, y: 0.78 },
  ];
  type LiveBubble = { block: Block; baseY: number; delay: number };
  let nodes: LiveBubble[] = [];
  const signature = () => {
    const pp = p();
    return `${pp.bubbleSize}|${pp.bubbles.map((b) => `${b.text}:${b.wide}`).join("§")}`;
  };
  const rebuild = () => {
    for (const n of nodes) n.block.destroy();
    nodes = [];
    const pp = p();
    pp.bubbles.forEach((b, i) => {
      const a = ANCHORS[i % ANCHORS.length] ?? { x: 0.5, y: 0.6 };
      const block = makeBubble(b.text, {
        fontSize: pp.bubbleSize,
        width: b.wide ? 360 : undefined,
        background: "rgba(255,255,255,0.92)",
        cornerRadius: [34, 34, 34, 6],
        shadow: { color: "#000", blur: 20, opacity: 0.18, offsetY: 6 },
      });
      block.x(a.x * W);
      block.y(a.y * H);
      s1bSeq.add(block);
      nodes.push({ block, baseY: block.y(), delay: i * 12 });
    });
  };
  let sig = signature();
  rebuild();
  s1bSeq.register((f) => {
    const next = signature();
    if (next !== sig) {
      rebuild();
      sig = next;
    }
    for (const { block, baseY, delay } of nodes) {
      const t = clamp01((f - delay) / (dur - delay));
      const e = easeOut(t);
      // drift up ~120px over its life, fade in then out.
      block.y(baseY - e * 120);
      const fadeIn = clamp01((f - delay) / 12);
      const fadeOut = 1 - clamp01((f - (dur - 18)) / 18);
      block.opacity(fadeIn * fadeOut);
    }
  });
}
// s1c: no text — let the sigh breathe.

// ── Scene 2 — The Solution (bright/warm relief) ──
// ALL clip audio MUTED (omit clipVol) — only music + VO carry this scene.
addClip(comp, {
  from: S2A,
  to: S2B,
  src: s2aUrl,
  name: "s2a",
  grade: "bright",
  kenBurns: true,
});
addClip(comp, { from: S2B, to: S2C, src: s2bUrl, name: "s2b", grade: "bright" });
addClip(comp, { from: S2C, to: S2_END, src: s2cUrl, name: "s2c", grade: "bright" });

// s2b: app name (prop) slides up; subtitle picks up the accent color.
{
  const seq = new Sequence({ from: S2B, durationInFrames: S2C - S2B });
  const dur = S2C - S2B;
  const heroY = Math.round(H * 0.6);
  const mkLT = (y: number, size: number, weight: string, fill: string, text: string) =>
    new Konva.Text({
      x: SAFE_X,
      y,
      width: Math.round(W * 0.62),
      text,
      fontFamily: FONT,
      fontSize: size,
      fontStyle: weight,
      fill,
      lineHeight: 1.15,
      shadowColor: "#000",
      shadowBlur: 24,
      shadowOpacity: 0.35,
      shadowOffset: { x: 0, y: 2 },
      opacity: 0,
    });
  const hero = mkLT(heroY, 92, "800", WHITE, p().appName);
  const sub = mkLT(heroY + 110, 40, "500", p().accent, "Your building, handled.");
  const heroBaseY = hero.y();
  const subBaseY = sub.y();
  seq.add(hero, sub);
  seq.register((f) => {
    hero.text(p().appName);
    sub.fill(p().accent);
    const a1 = fadeRise(f, 8, dur - 14);
    hero.opacity(a1.alpha);
    hero.y(heroBaseY + a1.dy);
    const a2 = fadeRise(f, 20, dur - 14);
    sub.opacity(a2.alpha);
    sub.y(subBaseY + a2.dy);
  });
  comp.add(seq);
}

// s2c: a UI feature card slides in from the right.
{
  const seq = new Sequence({ from: S2C, durationInFrames: S2_END - S2C });
  const dur = S2_END - S2C;
  const card = new Konva.Group({ x: W - 620, y: Math.round(H * 0.34) });
  const cw = 460;
  const ch = 150;
  const bg = new Konva.Rect({
    width: cw,
    height: ch,
    cornerRadius: 28,
    fill: WHITE,
    shadowColor: "#000",
    shadowBlur: 40,
    shadowOpacity: 0.25,
    shadowOffset: { x: 0, y: 18 },
  });
  const icon = new Konva.Rect({
    x: 32,
    y: ch / 2 - 36,
    width: 72,
    height: 72,
    cornerRadius: 20,
    fill: ACCENT,
  });
  const check = new Konva.Text({
    x: 32,
    y: ch / 2 - 36,
    width: 72,
    height: 72,
    text: "✓",
    fontFamily: FONT,
    fontSize: 44,
    fontStyle: "700",
    fill: WHITE,
    align: "center",
    verticalAlign: "middle",
  });
  const title = new Konva.Text({
    x: 130,
    y: 40,
    text: "Dues",
    fontFamily: FONT,
    fontSize: 34,
    fontStyle: "600",
    fill: INK,
  });
  const sub = new Konva.Text({
    x: 130,
    y: 84,
    text: "Paid · this month",
    fontFamily: FONT,
    fontSize: 26,
    fontStyle: "400",
    fill: "#64748b",
  });
  card.add(bg, icon, check, title, sub);
  seq.add(card);
  const baseX = card.x();
  seq.register((f) => {
    const e = easeBack(clamp01(f / 16));
    const tOut = clamp01((f - (dur - 14)) / 14);
    card.x(baseX + (1 - e) * 260);
    card.opacity(e * (1 - tOut));
  });
  comp.add(seq);
}

// ── Scene 3 — In Action (warm, golden, lively) ──
// Clip audio kept at −12 dB: the good-vibe chatter adds life and energy.
addClip(comp, {
  from: S3A,
  to: S3B,
  src: s3aUrl,
  name: "s3a",
  grade: "warm",
  clipVol: CLIP_12,
});
addClip(comp, {
  from: S3B,
  to: S3C,
  src: s3bUrl,
  name: "s3b",
  grade: "warm",
  clipVol: CLIP_12,
});
addClip(comp, {
  from: S3C,
  to: S3_END,
  src: s3cUrl,
  name: "s3c",
  grade: "warm",
  clipVol: CLIP_12,
});

// Benefit chips — same screen position, slide up from bottom + fade.
const chips = [
  { from: S3A, to: S3B, label: "Coordinate residents" },
  { from: S3B, to: S3C, label: "Track dues & expenses" },
  { from: S3C, to: S3_END, label: "Vote & decide together" },
];
for (const c of chips) {
  const seq = new Sequence({ from: c.from, durationInFrames: c.to - c.from });
  const dur = c.to - c.from;
  const { group, width: cw } = makeChip(c.label);
  const chipY = Math.round(H * 0.76);
  group.x(SAFE_X);
  group.y(chipY);
  void cw;
  seq.add(group);
  const baseY = group.y();
  seq.register((f) => {
    const { alpha, dy } = fadeRise(f, 8, dur - 14, { rise: 44 });
    group.opacity(alpha);
    group.y(baseY + dy);
  });
  comp.add(seq);
}

// ── Scene 4 — The Payoff (bright, airy "after") ──
// Crossfade in: s4a starts 12f early, fading over the tail of s3c.
const XF = 12;
addClip(comp, {
  from: S4A - XF,
  to: S4B,
  src: s4aUrl,
  name: "s4a",
  grade: "bright",
  fadeIn: XF,
  kenBurns: true,
  clipVol: CLIP_18,
});
addClip(comp, {
  from: S4B,
  to: S4C,
  src: s4bUrl,
  name: "s4b",
  grade: "bright",
  clipVol: CLIP_18,
});
addClip(comp, {
  from: S4C,
  to: TOTAL,
  src: s4cUrl,
  name: "s4c",
  grade: "bright",
  clipVol: 0,
});

// s4b: soft tagline.
{
  const seq = new Sequence({ from: S4B, durationInFrames: S4C - S4B });
  const dur = S4C - S4B;
  addCaption(seq, "One app. Less chaos.", 8, dur - 14, {
    size: 56,
    weight: "700",
    y: Math.round(H * 0.74),
  });
  comp.add(seq);
}

// s4c: END CARD — logo settles into top negative space, tagline, CTA pill.
{
  const seq = new Sequence({ from: S4C, durationInFrames: TOTAL - S4C });

  // Soft scrim so type reads over bright footage.
  const scrim = new Konva.Rect({
    x: 0,
    y: 0,
    width: W,
    height: H,
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint: { x: 0, y: H },
    fillLinearGradientColorStops: [0, "rgba(255,255,255,0.0)", 1, "rgba(255,255,255,0.55)"],
    listening: false,
  });
  seq.add(scrim);

  const {
    group: logo,
    mark: logoMark,
    word: logoWordNode,
  } = makeLogo(1, p().logoWord === "white" ? WHITE : INK, p().accent);
  logo.x(W / 2);
  logo.y(Math.round(H * 0.3));
  seq.add(logo);

  // Accent line drawing left-to-right under the logo — the original intro
  // animation, now landing here as the final beat.
  const lineFull = 420;
  const lineY = Math.round(H * 0.3) + 96;
  const line = new Konva.Rect({
    x: W / 2 - lineFull / 2,
    y: lineY,
    width: 0,
    height: 5,
    cornerRadius: 3,
    fill: p().accent,
  });
  seq.add(line);

  const tagline = new Konva.Text({
    x: 0,
    y: Math.round(H * 0.46),
    width: W,
    align: "center",
    text: p().endCard.tagline,
    fontFamily: FONT,
    fontSize: 44,
    fontStyle: "500",
    fill: INK,
    opacity: 0,
  });
  seq.add(tagline);

  // CTA accent pill button.
  const ctaLabel = p().endCard.ctaLabel;
  const ctaTxt = new Konva.Text({
    text: ctaLabel,
    fontFamily: FONT,
    fontSize: 38,
    fontStyle: "700",
    fill: WHITE,
  });
  const cpadX = 56;
  const cpadY = 30;
  const cw = ctaTxt.width() + cpadX * 2;
  const ch = 38 + cpadY * 2;
  const cta = new Konva.Group({ x: W / 2 - cw / 2, y: Math.round(H * 0.62) });
  const ctaBg = new Konva.Rect({
    width: cw,
    height: ch,
    cornerRadius: ch / 2,
    fill: p().endCard.ctaColor,
    shadowColor: ACCENT_DARK,
    shadowBlur: 36,
    shadowOpacity: 0.55,
    shadowOffset: { x: 0, y: 14 },
  });
  ctaTxt.x(cpadX);
  ctaTxt.y(cpadY);
  cta.add(ctaBg, ctaTxt);
  seq.add(cta);

  const logoBaseScale = 1;
  const tagBaseY = tagline.y();
  const ctaBaseY = cta.y();
  seq.register((f) => {
    // ── live prop application (text / colors / visibility) ──
    const pp = p();
    logoMark.fill(pp.accent);
    logoWordNode.fill(pp.logoWord === "white" ? WHITE : INK);
    tagline.text(pp.endCard.tagline);
    // CTA label can change width → re-measure, re-center, recolor.
    ctaTxt.text(pp.endCard.ctaLabel);
    const cwNow = ctaTxt.width() + cpadX * 2;
    ctaBg.width(cwNow);
    ctaBg.fill(pp.endCard.ctaColor);
    ctaTxt.x(cpadX);
    cta.x(W / 2 - cwNow / 2);

    // logo scales 95→100 + fade.
    const e = easeOut(clamp01(f / 16));
    const s = (0.95 + 0.05 * e) * logoBaseScale;
    logo.scaleX(s);
    logo.scaleY(s);
    logo.opacity(e);

    // line draws once the logo has settled (frames 18..40).
    line.visible(pp.endCard.showAccentLine);
    line.fill(pp.accent);
    const lw = interpolate(f, [18, 40], [0, lineFull], {
      easing: easeOut,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    line.width(lw);
    line.x(W / 2 - lw / 2);
    line.opacity(e);

    const tag = fadeRise(f, 14, 9999, { rise: 8 });
    tagline.opacity(tag.alpha);
    tagline.y(tagBaseY + tag.dy);

    const c = fadeRise(f, 26, 9999, { rise: 10 });
    cta.opacity(c.alpha);
    cta.y(ctaBaseY + c.dy);
  });
  comp.add(seq);
}

// ── Audio: music stems ──────────────────────────────────────────────────
// Bottom of the stack. 0.5s crossfades at each scene boundary; the curves
// overlap so a rising stem meets a falling one.
const XFM = sec(0.5);
addMusic(comp, {
  src: s1Music,
  name: "Music · S1",
  from: 0,
  to: S1_END,
  // From 0:00, fades to near-silence by the end of s1c.
  curve: (g) =>
    interpolate(g, [0, 12, 180, S1_END], [0, MUSIC_BASE, MUSIC_BASE * 0.6, 0.06], CLAMP),
});
addMusic(comp, {
  src: s2Music,
  name: "Music · S2",
  from: S2A - XFM,
  to: S2_END,
  // From 0:00, rises in over the relief.
  curve: (g) =>
    interpolate(
      g,
      [S2A - XFM, S2A + 30, S2_END - XFM, S2_END],
      [0, MUSIC_BASE, MUSIC_BASE, 0.1],
      CLAMP,
    ),
});
// One bed (s4-audio, from 1:05) carries Scenes 3 + 4 — rises in over the
// action, builds to resolve on the logo, then fades out over the final 1.5s.
addMusic(comp, {
  src: s4Music,
  name: "Music · S3+S4",
  from: S3A - XFM,
  to: TOTAL,
  trimBefore: sec(75), // use from 1:05
  curve: (g) =>
    interpolate(
      g,
      [S3A - XFM, S3A + 20, S4A, S4C + 30, TOTAL - sec(1.5), TOTAL],
      [0, MUSIC_BASE * 0.85, MUSIC_BASE * 0.85, MUSIC_BASE, MUSIC_BASE, 0],
      CLAMP,
    ),
});

// ── Audio: voiceover (top of the mix — ducks everything below −6 dB) ──────
addVo(comp, { src: vo1Url, name: "VO1", from: VO.v1.from, to: VO.v1.to });
addVo(comp, { src: vo2Url, name: "VO2", from: VO.v2.from, to: VO.v2.to });
addVo(comp, { src: vo3Url, name: "VO3", from: VO.v3.from, to: VO.v3.to });
addVo(comp, { src: vo4Url, name: "VO4", from: VO.v4.from, to: VO.v4.to });

// ── Audio: SFX — whooshes on the 4 transition/reveal points ───────────────
// whoosh-a (biggest hit) on the s1c→s2a white flash.
addSfx(comp, { src: whooshAUrl, name: "whoosh-a", from: S2A - 10, dur: sec(2.1), volume: 0.6 });
// whoosh-b on the two fast scene-3 cuts.
addSfx(comp, { src: whooshBUrl, name: "whoosh-b", from: S3B - 6, dur: sec(1), volume: 0.45 });
addSfx(comp, { src: whooshBUrl, name: "whoosh-b", from: S3C - 6, dur: sec(1), volume: 0.45 });
// whoosh-a again on the s3→s4 crossfade — softer, pulls the energy down.
addSfx(comp, {
  src: whooshAUrl,
  name: "whoosh-a",
  from: S4A - XF,
  dur: sec(2.1),
  volume: 0.38,
});
// whoosh-b (soft) on the logo reveal. (A dedicated logo-chime SFX would sit
// here too — no asset shipped for it yet.)
addSfx(comp, { src: whooshBUrl, name: "whoosh-b", from: S4C, dur: sec(2), volume: 0.3 });

// ── Global FX overlay (top-most): fade-from-black, white flash, end fade ──
{
  const seq = new Sequence({ from: 0, durationInFrames: TOTAL });

  const black = new Konva.Rect({
    x: 0,
    y: 0,
    width: W,
    height: H,
    fill: "#000",
    listening: false,
  });
  const flash = new Konva.Rect({
    x: 0,
    y: 0,
    width: W,
    height: H,
    fill: "#fff",
    listening: false,
    opacity: 0,
  });
  const endFade = new Konva.Rect({
    x: 0,
    y: 0,
    width: W,
    height: H,
    fill: "#fff",
    listening: false,
    opacity: 0,
  });
  seq.add(black, flash, endFade);

  seq.register((f) => {
    // Cold open: short 0.3s fade up from black.
    black.opacity(1 - clamp01(f / sec(0.3)));
    // White flash on the S1→S2 cut (the relief moment).
    const flashIn = clamp01((f - (S2A - 6)) / 6);
    const flashOut = 1 - clamp01((f - S2A) / 12);
    flash.opacity(flashIn * flashOut * 0.9);
    // Frame out over the final 1.5s as the music resolves.
    endFade.opacity(clamp01((f - (TOTAL - sec(1.5))) / sec(1.5)));
  });
  comp.add(seq);
}

export default comp;
