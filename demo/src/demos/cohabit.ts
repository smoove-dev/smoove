import { Composition, Easing, Sequence, Video, interpolate } from "@konva-motion/core";
import Konva from "konva";
import s1aUrl from "../files/film/s1a.mp4";
import s1bUrl from "../files/film/s1b.mp4";
import s1cUrl from "../files/film/s1c.mp4";
import s2aUrl from "../files/film/s2a.mp4";
import s2bUrl from "../files/film/s2b.mp4";
import s2cUrl from "../files/film/s2c.mp4";
import s3aUrl from "../files/film/s3a.mp4";
import s3bUrl from "../files/film/s3b.mp4";
import s3cUrl from "../files/film/s3c.mp4";
import s4aUrl from "../files/film/s4a.mp4";
import s4bUrl from "../files/film/s4b.mp4";
import s4cUrl from "../files/film/s4c.mp4";
import type { DemoDef } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────
// Cohabit — Director's Edit Brief. 1920×1080, 30fps, ~32s.
// Intro logo → Scene 1 (problem) → 2 (solution) → 3 (in action) → 4 (payoff).
// ─────────────────────────────────────────────────────────────────────────

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
const INTRO = sec(2); // 0..60
// Scene 1 — 8s, three clips
const S1A = INTRO; // 60
const S1B = S1A + sec(2.67); // 140
const S1C = S1B + sec(2.67); // 220
const S1_END = S1C + sec(2.66); // 300
// Scene 2 — 8s
const S2A = S1_END; // 300
const S2B = S2A + sec(2.67); // 380
const S2C = S2B + sec(2.67); // 460
const S2_END = S2C + sec(2.66); // 540
// Scene 3 — 8s, faster cuts
const S3A = S2_END; // 540
const S3B = S3A + sec(2.67); // 620
const S3C = S3B + sec(2.67); // 700
const S3_END = S3C + sec(2.66); // 780
// Scene 4 — 6s
const S4A = S3_END; // 780
const S4B = S4A + sec(1.8); // 834
const S4C = S4B + sec(1.8); // 888
const TOTAL = sec(32); // 960

const easeOut = Easing.out(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);
const easeBack = Easing.out(Easing.back(1.6));

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

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
};

function addClip(comp: Composition, o: ClipOpts): Sequence {
  const dur = o.to - o.from;
  const seq = new Sequence({ from: o.from, durationInFrames: dur });

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
    muted: false,
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

/** A rounded accent "chip" with white text, sized to its label. */
function makeChip(label: string, size = 44): { group: Konva.Group; width: number } {
  const padX = 40;
  const padY = 24;
  const txt = new Konva.Text({
    text: label,
    fontFamily: FONT,
    fontSize: size,
    fontStyle: "600",
    fill: WHITE,
  });
  const w = txt.width() + padX * 2;
  const h = size + padY * 2;
  const group = new Konva.Group();
  const rect = new Konva.Rect({
    x: 0,
    y: 0,
    width: w,
    height: h,
    cornerRadius: h / 2,
    fill: ACCENT,
    shadowColor: ACCENT_DARK,
    shadowBlur: 30,
    shadowOpacity: 0.5,
    shadowOffset: { x: 0, y: 10 },
  });
  txt.x(padX);
  txt.y(padY);
  group.add(rect, txt);
  return { group, width: w };
}

// ── Logo (typographic wordmark + simple building mark) ─────────────────────
/** Returns a centered group; its internal origin is (0,0) at center. */
function makeLogo(scale = 1, wordColor: string = INK): Konva.Group {
  const g = new Konva.Group();

  const markSize = 84 * scale;
  // Rounded accent square with two "windows" → suggests a building.
  const mark = new Konva.Rect({
    x: 0,
    y: 0,
    width: markSize,
    height: markSize,
    cornerRadius: markSize * 0.26,
    fill: ACCENT,
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
  return g;
}

// ── Build ──────────────────────────────────────────────────────────────────
export const cohabitDemo: DemoDef = {
  id: "cohabit",
  name: "Cohabit · 32s",
  build(container, width, height) {
    const comp = new Composition({
      id: "cohabit",
      fps: FPS,
      durationInFrames: TOTAL,
      container,
      width: W,
      height: H,
      loop: true,
    });

    // Fit the 1920×1080 design canvas into the available preview area.
    const host = document.getElementById(container);
    if (host) {
      const scale = Math.min(width / W, height / H);
      host.style.transform = `scale(${scale})`;
      host.style.transformOrigin = "center center";
    }

    // ── Scene 1 — The Problem (cool, desaturated "before") ──
    addClip(comp, { from: S1A, to: S1B, src: s1aUrl, name: "s1a", grade: "cool", kenBurns: true });
    const s1bSeq = addClip(comp, {
      from: S1B,
      to: S1C,
      src: s1bUrl,
      name: "s1b",
      grade: "cool",
    });
    addClip(comp, { from: S1C, to: S1_END, src: s1cUrl, name: "s1c", grade: "cool" });

    // s1a headline.
    {
      const seq = new Sequence({ from: S1A, durationInFrames: S1B - S1A });
      addCaption(seq, "Managing a building\nshouldn't feel like this.", 20, S1B - S1A - 16, {
        size: 64,
        weight: "700",
        y: Math.round(H * 0.62),
      });
      comp.add(seq);
    }

    // s1b overwhelm: floating chat bubbles drifting up + fading.
    {
      const bubbles: { text: string; x: number; y: number; delay: number }[] = [
        { text: "Dues?", x: 0.18, y: 0.55, delay: 6 },
        { text: "Leak again", x: 0.36, y: 0.68, delay: 18 },
        { text: "Meeting?", x: 0.6, y: 0.5, delay: 30 },
        { text: "Who's paying?", x: 0.5, y: 0.74, delay: 42 },
      ];
      const dur = S1C - S1B;
      for (const b of bubbles) {
        const txt = new Konva.Text({
          text: b.text,
          fontFamily: FONT,
          fontSize: 34,
          fontStyle: "500",
          fill: "#5b6472",
        });
        const padX = 30;
        const padY = 20;
        const bw = txt.width() + padX * 2;
        const bh = 34 + padY * 2;
        const group = new Konva.Group({ x: b.x * W, y: b.y * H });
        const rect = new Konva.Rect({
          width: bw,
          height: bh,
          cornerRadius: [bh / 2, bh / 2, bh / 2, 6],
          fill: WHITE,
          opacity: 0.88,
          shadowColor: "#000",
          shadowBlur: 20,
          shadowOpacity: 0.18,
          shadowOffset: { x: 0, y: 6 },
        });
        txt.x(padX);
        txt.y(padY);
        group.add(rect, txt);
        s1bSeq.add(group);
        const baseY = group.y();
        s1bSeq.register((f) => {
          const t = clamp01((f - b.delay) / (dur - b.delay));
          const e = easeOut(t);
          // drift up ~120px over its life, fade in then out.
          group.y(baseY - e * 120);
          const fadeIn = clamp01((f - b.delay) / 12);
          const fadeOut = 1 - clamp01((f - (dur - 18)) / 18);
          group.opacity(fadeIn * fadeOut);
        });
      }
    }
    // s1c: no text — let the sigh breathe.

    // ── Scene 2 — The Solution (bright/warm relief) ──
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

    // s2b: app name slides up beside the action.
    {
      const seq = new Sequence({ from: S2B, durationInFrames: S2C - S2B });
      const dur = S2C - S2B;
      addCaption(seq, "Cohabit", 8, dur - 14, {
        size: 92,
        weight: "800",
        color: WHITE,
        y: Math.round(H * 0.6),
      });
      addCaption(seq, "Your building, handled.", 20, dur - 14, {
        size: 40,
        weight: "500",
        color: ACCENT,
        y: Math.round(H * 0.6) + 110,
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
    addClip(comp, { from: S3A, to: S3B, src: s3aUrl, name: "s3a", grade: "warm" });
    addClip(comp, { from: S3B, to: S3C, src: s3bUrl, name: "s3b", grade: "warm" });
    addClip(comp, { from: S3C, to: S3_END, src: s3cUrl, name: "s3c", grade: "warm" });

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
    });
    addClip(comp, { from: S4B, to: S4C, src: s4bUrl, name: "s4b", grade: "bright" });
    addClip(comp, { from: S4C, to: TOTAL, src: s4cUrl, name: "s4c", grade: "bright" });

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

      const logo = makeLogo(1);
      logo.x(W / 2);
      logo.y(Math.round(H * 0.3));
      seq.add(logo);

      const tagline = new Konva.Text({
        x: 0,
        y: Math.round(H * 0.46),
        width: W,
        align: "center",
        text: "Your building, handled.",
        fontFamily: FONT,
        fontSize: 44,
        fontStyle: "500",
        fill: INK,
        opacity: 0,
      });
      seq.add(tagline);

      // CTA accent pill button.
      const ctaLabel = "Start free →";
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
        fill: ACCENT,
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
        // logo scales 95→100 + fade.
        const e = easeOut(clamp01(f / 16));
        const s = (0.95 + 0.05 * e) * logoBaseScale;
        logo.scaleX(s);
        logo.scaleY(s);
        logo.opacity(e);

        const tag = fadeRise(f, 14, 9999, { rise: 8 });
        tagline.opacity(tag.alpha);
        tagline.y(tagBaseY + tag.dy);

        const c = fadeRise(f, 26, 9999, { rise: 10 });
        cta.opacity(c.alpha);
        cta.y(ctaBaseY + c.dy);
      });
      comp.add(seq);
    }

    // ── INTRO logo (cold open) — added before global FX so FX flashes sit on top ──
    {
      const seq = new Sequence({ from: 0, durationInFrames: INTRO });
      const bg = new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: "#0b1220" });
      seq.add(bg);

      const logo = makeLogo(1.1, WHITE);
      logo.x(W / 2);
      logo.y(H / 2 - 20);
      seq.add(logo);

      // Accent line that draws underneath the logo.
      const lineFull = 420;
      const lineY = H / 2 + 90;
      const line = new Konva.Rect({
        x: W / 2 - lineFull / 2,
        y: lineY,
        width: 0,
        height: 5,
        cornerRadius: 3,
        fill: ACCENT,
      });
      seq.add(line);

      seq.register((f) => {
        // logo scales 95→100 + fades up over 8..30
        const e = easeOut(
          interpolate(f, [8, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        );
        const s = 0.95 + 0.05 * e;
        logo.scaleX(s);
        logo.scaleY(s);
        // line draws 24..44; everything fades out 50..60 as s1a begins.
        const lw = interpolate(f, [24, 44], [0, lineFull], {
          easing: easeOut,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        line.width(lw);
        line.x(W / 2 - lw / 2);
        const out = 1 - clamp01((f - 50) / 10);
        logo.opacity(e * out);
        line.opacity(out);
        bg.opacity(out); // reveal s1a underneath as the black clears
      });
      comp.add(seq);
    }

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
        // Fade up from black over the first 0.5s.
        black.opacity(1 - clamp01(f / sec(0.5)));
        // White flash on the S1→S2 cut (the relief moment).
        const flashIn = clamp01((f - (S2A - 6)) / 6);
        const flashOut = 1 - clamp01((f - S2A) / 12);
        flash.opacity(flashIn * flashOut * 0.9);
        // Resolve to a clean white frame on the final note.
        endFade.opacity(clamp01((f - (TOTAL - 14)) / 14));
      });
      comp.add(seq);
    }

    return comp;
  },
};
