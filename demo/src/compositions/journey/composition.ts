import { Block, Composition, Easing, Image, Sequence, interpolate } from "@konva-motion/core";
import Konva from "konva";

type Chapter = {
  label: string;
  title: string;
  body: string;
  signature: string;
  hero: string;
  polaroid: string;
  accent: string;
  titleItalic: boolean;
  tint: string;
};

const CHAPTERS: Chapter[] = [
  {
    label: "CHAPTER 01 · DAWN",
    title: "Above the Clouds",
    body: "The first light spilled across granite ridges, painting the silence gold.",
    signature: "— from a notebook, 6:14 AM",
    hero: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&q=80",
    polaroid: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600&q=80",
    accent: "#ffd166",
    titleItalic: false,
    tint: "#1a1410",
  },
  {
    label: "CHAPTER 02 · DEEP GREEN",
    title: "Where the Forest Breathes",
    body: "Moss muffled every footstep. Somewhere overhead, a thrush was tuning the air.",
    signature: "the long path, day two",
    hero: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80",
    polaroid: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600&q=80",
    accent: "#a7e3a1",
    titleItalic: true,
    tint: "#0c1410",
  },
  {
    label: "CHAPTER 03 · SALT & HORIZON",
    title: "The Wide Blue Hour",
    body: "Past the dunes the world simply stopped — and I sat down at its edge.",
    signature: "I forgot what I was looking for.",
    hero: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1600&q=80",
    polaroid: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80",
    accent: "#74c0fc",
    titleItalic: false,
    tint: "#0a1722",
  },
  {
    label: "CHAPTER 04 · CITY OF LIGHT",
    title: "Home, in Neon",
    body: "Forty days of weather on my coat — and a thousand windows lit just for me.",
    signature: "back, finally.",
    hero: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1600&q=80",
    polaroid: "https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=600&q=80",
    accent: "#ff9ecb",
    titleItalic: true,
    tint: "#10081a",
  },
];

const CHAPTER_DURATION = 600;
const TOTAL_DURATION = CHAPTER_DURATION * CHAPTERS.length;

const FONT_TITLE = '"Playfair Display", Georgia, serif';
const FONT_BODY = '"Inter", system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';
const FONT_HAND = '"Caveat", "Brush Script MT", cursive';

const easeOutCubic = Easing.out(Easing.cubic);
const easeInOutCubic = Easing.inOut(Easing.cubic);

const formatTimecode = (frame: number, fps: number, total: number): string => {
  const sec = Math.min(total / fps, frame / fps);
  const totalSec = total / fps;
  const fmt = (s: number): string => {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };
  return `${fmt(sec)} / ${fmt(totalSec)}`;
};

const width = 1280;
const height = 720;
const comp = new Composition({
  id: "journey",
  fps: 60,
  durationInFrames: TOTAL_DURATION,
  width,
  height,
  loop: true,
});

const letterboxH = Math.max(36, Math.round(height * 0.08));

// Background sequence: solid base + slow tint crossfade across chapters.
const bg = new Sequence({ from: 0, durationInFrames: TOTAL_DURATION });
const bgRect = new Konva.Rect({
  x: 0,
  y: 0,
  width,
  height,
  fill: CHAPTERS[0]?.tint ?? "#000",
});
bg.add(bgRect);
bg.register((frame) => {
  const idx = Math.min(CHAPTERS.length - 1, Math.floor(frame / CHAPTER_DURATION));
  bgRect.fill(CHAPTERS[idx]?.tint ?? "#000");
});
comp.add(bg);

// One sequence per chapter.
for (let i = 0; i < CHAPTERS.length; i++) {
  const ch = CHAPTERS[i];
  if (!ch) continue;
  const seq = new Sequence({
    from: i * CHAPTER_DURATION,
    durationInFrames: CHAPTER_DURATION,
  });

  // Hero image lives in a clipping group so the Ken Burns zoom doesn't
  // bleed past the stage edges.
  const heroClip = new Konva.Group({
    x: 0,
    y: 0,
    clipX: 0,
    clipY: 0,
    clipWidth: width,
    clipHeight: height,
  });
  const hero = new Image({
    src: ch.hero,
    width,
    height,
    objectFit: "cover",
    objectPosition: "center",
    x: width / 2,
    y: height / 2,
    offsetX: width / 2,
    offsetY: height / 2,
  });
  heroClip.add(hero);
  seq.add(heroClip);

  // Vignette: dark gradient from top transparent → bottom 70% black.
  const vignette = new Block({
    x: 0,
    y: 0,
    width,
    height,
    background: {
      gradient: {
        type: "linear",
        angle: 90,
        stops: [
          [0, "rgba(0,0,0,0)"],
          [0.55, "rgba(0,0,0,0.15)"],
          [1, "rgba(0,0,0,0.78)"],
        ],
      },
    },
  });
  seq.add(vignette);

  // Polaroid (picture-in-picture, top-right).
  const polW = Math.min(220, Math.round(width * 0.22));
  const polPad = 10;
  const polImgH = polW - polPad * 2;
  const polH = polImgH + polPad * 2 + 36;
  const polaroid = new Block({
    x: width - polW - 40,
    y: 80,
    width: polW,
    height: polH,
    padding: polPad,
    flexDirection: "column",
    background: "#f4f1ea",
    cornerRadius: 4,
    shadow: {
      color: "#000",
      blur: 22,
      offsetX: 4,
      offsetY: 10,
      opacity: 0.45,
    },
    rotation: -4,
  });
  const polImage = new Image({
    src: ch.polaroid,
    width: polW - polPad * 2,
    height: polImgH,
    objectFit: "cover",
  });
  polaroid.add(polImage);
  const polCaption = new Konva.Text({
    text: ch.signature,
    fontFamily: FONT_HAND,
    fontSize: 18,
    fill: "#2a2a2a",
    width: polW - polPad * 2,
    align: "center",
    y: polImgH + polPad + 4,
  });
  polaroid.add(polCaption);
  seq.add(polaroid);

  // Text stack (bottom-left, inside the letterbox).
  const textX = 56;
  const textBottomY = height - letterboxH - 36;

  const titleSize = Math.min(64, Math.round(width * 0.062));
  const titleNode = new Konva.Text({
    text: ch.title,
    x: textX,
    y: textBottomY - titleSize - 8,
    fontFamily: FONT_TITLE,
    fontSize: titleSize,
    fontStyle: ch.titleItalic ? "italic bold" : "bold",
    fill: "#ffffff",
    width: width - textX * 2 - polW - 40,
  });

  const labelNode = new Konva.Text({
    text: ch.label,
    x: textX,
    y: textBottomY - titleSize - 8 - 22,
    fontFamily: FONT_MONO,
    fontSize: 12,
    fontStyle: "bold",
    fill: ch.accent,
    letterSpacing: 2,
  });

  const bodyNode = new Konva.Text({
    text: ch.body,
    x: textX,
    y: textBottomY + 12,
    fontFamily: FONT_BODY,
    fontSize: 18,
    fill: "rgba(255,255,255,0.82)",
    width: Math.min(720, width - textX * 2 - polW - 40),
    lineHeight: 1.35,
  });

  const sigNode = new Konva.Text({
    text: ch.signature,
    x: textX,
    y: textBottomY + 80,
    fontFamily: FONT_HAND,
    fontSize: 26,
    fill: ch.accent,
  });

  seq.add(labelNode, titleNode, bodyNode, sigNode);

  // Black fade overlay (in & out).
  const fadeRect = new Konva.Rect({
    x: 0,
    y: 0,
    width,
    height,
    fill: "#000000",
    opacity: 1,
    listening: false,
  });
  seq.add(fadeRect);

  seq.register((f) => {
    // Hero Ken Burns — scale 1.0 → 1.10 across the chapter.
    const heroScale = interpolate(f, [0, CHAPTER_DURATION], [1.0, 1.1], {
      easing: easeInOutCubic,
    });
    hero.scaleX(heroScale);
    hero.scaleY(heroScale);

    // Chapter label: typewriter (frames 30..90).
    const labelChars = Math.round(
      interpolate(f, [30, 90], [0, ch.label.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
    labelNode.text(ch.label.slice(0, labelChars));

    // Title: slide up + fade in (frames 60..150).
    const titleAlpha = interpolate(f, [60, 150], [0, 1], {
      easing: easeOutCubic,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const titleOffsetY = interpolate(f, [60, 150], [40, 0], {
      easing: easeOutCubic,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    titleNode.opacity(titleAlpha);
    titleNode.y(textBottomY - titleSize - 8 + titleOffsetY);

    // Body: fade in 130..200.
    bodyNode.opacity(
      interpolate(f, [130, 200], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );

    // Signature: fade + scale 220..300.
    const sigAlpha = interpolate(f, [220, 300], [0, 1], {
      easing: easeOutCubic,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const sigScale = interpolate(f, [220, 300], [0.9, 1], {
      easing: easeOutCubic,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    sigNode.opacity(sigAlpha);
    sigNode.scaleX(sigScale);
    sigNode.scaleY(sigScale);

    // Polaroid: slide in from off-screen right (60..140), idle, slide out (500..580).
    const polarX = width - polW - 40;
    const polarOffX = width + 60;
    const inPhase = interpolate(f, [60, 140], [polarOffX, polarX], {
      easing: easeOutCubic,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const outPhase = interpolate(f, [500, 580], [0, polarOffX - polarX], {
      easing: Easing.in(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    polaroid.x(inPhase + outPhase);
    const polarRot = interpolate(
      0.5 - 0.5 * Math.cos((f / CHAPTER_DURATION) * Math.PI * 2),
      [0, 1],
      [-5, -2],
    );
    polaroid.rotation(polarRot);

    // Black fade: in 0..45, out 555..599.
    const fadeIn = interpolate(f, [0, 45], [1, 0], {
      easing: easeOutCubic,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const fadeOut = interpolate(f, [555, 599], [0, 1], {
      easing: Easing.in(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    fadeRect.opacity(Math.max(fadeIn, fadeOut));
  });

  comp.add(seq);
}

// Overlay sequence: letterbox bars, timecode, progress bar.
const overlay = new Sequence({ from: 0, durationInFrames: TOTAL_DURATION });

const topBar = new Konva.Rect({
  x: 0,
  y: 0,
  width,
  height: letterboxH,
  fill: "#000",
  listening: false,
});
const bottomBar = new Konva.Rect({
  x: 0,
  y: height - letterboxH,
  width,
  height: letterboxH,
  fill: "#000",
  listening: false,
});
overlay.add(topBar, bottomBar);

const timecode = new Konva.Text({
  x: width - 180,
  y: height - letterboxH + (letterboxH - 12) / 2,
  width: 160,
  align: "right",
  text: "00:00 / 00:40",
  fontFamily: FONT_MONO,
  fontSize: 12,
  fill: "rgba(255,255,255,0.7)",
  letterSpacing: 1,
});
overlay.add(timecode);

const chapterReadout = new Konva.Text({
  x: 24,
  y: height - letterboxH + (letterboxH - 12) / 2,
  text: "01 / 04",
  fontFamily: FONT_MONO,
  fontSize: 12,
  fill: "rgba(255,255,255,0.7)",
  letterSpacing: 1,
});
overlay.add(chapterReadout);

const progressTrack = new Konva.Rect({
  x: 0,
  y: height - letterboxH - 3,
  width,
  height: 3,
  fill: "rgba(255,255,255,0.08)",
  listening: false,
});
const progressFill = new Konva.Rect({
  x: 0,
  y: height - letterboxH - 3,
  width: 0,
  height: 3,
  fill: "#ffffff",
  listening: false,
});
overlay.add(progressTrack, progressFill);

overlay.register((frame) => {
  const barIn = interpolate(frame, [0, 30], [letterboxH, 0], {
    easing: easeOutCubic,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const barOut = interpolate(frame, [TOTAL_DURATION - 30, TOTAL_DURATION], [0, letterboxH], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const off = Math.max(barIn, barOut);
  topBar.y(-off);
  bottomBar.y(height - letterboxH + off);

  timecode.text(formatTimecode(frame, comp.fps, TOTAL_DURATION));
  const chapterIdx = Math.min(CHAPTERS.length - 1, Math.floor(frame / CHAPTER_DURATION));
  chapterReadout.text(
    `${String(chapterIdx + 1).padStart(2, "0")} / ${String(CHAPTERS.length).padStart(2, "0")}`,
  );
  progressFill.width(width * (frame / TOTAL_DURATION));
});

comp.add(overlay);
export default comp;
