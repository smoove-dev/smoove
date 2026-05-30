import { Block, Composition, Easing, Image, Sequence, interpolate } from "@konva-motion/core";
import Konva from "konva";
import type { DemoDef } from "./types.js";

const FPS = 60;
const SCENE = 180; // 3s
const SCENES_COUNT = 10;
const TOTAL = SCENE * SCENES_COUNT;

const F_DISPLAY = '"Bebas Neue", "Anton", Impact, sans-serif';
const F_SERIF = '"Playfair Display", Georgia, serif';
const F_HAND = '"Caveat", "Brush Script MT", cursive';
const F_MONO = '"JetBrains Mono", ui-monospace, monospace';
const F_SANS = '"Inter", system-ui, sans-serif';

const easeOut = Easing.out(Easing.cubic);
const easeIn = Easing.in(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);
const easeBack = Easing.out(Easing.back(2));
const easeBounce = Easing.out(Easing.bounce);
const easeElastic = Easing.out(Easing.elastic(1.4));

type Word = { text: string; color: string; font: string; size: number; italic?: boolean };
type Sticker = { emoji: string; x: number; y: number; size: number; rot?: number };

type Scene = {
  bg: [string, string]; // gradient stops (top->bottom)
  hero?: string;
  heroOpacity?: number;
  layout: "stack" | "split" | "center";
  topLabel?: { text: string; font: string; color: string };
  words: Word[]; // each line is one word/phrase animated separately
  caption?: { text: string; font: string; color: string; size: number };
  stickers: Sticker[];
  enter: "explode" | "slideUp" | "slideRight" | "zoomBounce" | "spin" | "wobble";
};

const SCENES: Scene[] = [
  // 1. INTRO
  {
    bg: ["#ff2d75", "#ff7a3a"],
    layout: "center",
    topLabel: { text: "READY OR NOT", font: F_MONO, color: "#fff" },
    words: [
      { text: "READY", color: "#fff", font: F_DISPLAY, size: 140 },
      { text: "OR NOT", color: "#fff200", font: F_DISPLAY, size: 100, italic: true },
      { text: "HERE WE GO", color: "#fff", font: F_DISPLAY, size: 70 },
    ],
    caption: { text: "swipe up if you dare", font: F_HAND, color: "#fff", size: 32 },
    stickers: [
      { emoji: "🔥", x: 0.12, y: 0.18, size: 64, rot: -15 },
      { emoji: "✨", x: 0.85, y: 0.22, size: 56, rot: 12 },
      { emoji: "💫", x: 0.18, y: 0.82, size: 60, rot: -20 },
      { emoji: "⚡", x: 0.82, y: 0.78, size: 60, rot: 18 },
    ],
    enter: "explode",
  },
  // 2. WANDERLUST
  {
    bg: ["#0c1a3a", "#3a78c8"],
    hero: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&q=80",
    heroOpacity: 0.55,
    layout: "stack",
    topLabel: { text: "DAY 01", font: F_MONO, color: "#7dd3fc" },
    words: [
      { text: "wanderlust", color: "#fff", font: F_SERIF, size: 92, italic: true },
      { text: "ACTIVATED", color: "#fde047", font: F_DISPLAY, size: 80 },
    ],
    caption: { text: "next stop: anywhere", font: F_HAND, color: "#fff", size: 30 },
    stickers: [
      { emoji: "✈️", x: 0.85, y: 0.15, size: 72, rot: 25 },
      { emoji: "🗺️", x: 0.12, y: 0.78, size: 60, rot: -10 },
      { emoji: "🌍", x: 0.88, y: 0.85, size: 58 },
    ],
    enter: "slideRight",
  },
  // 3. FOODIE
  {
    bg: ["#fde68a", "#f97316"],
    hero: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&q=80",
    heroOpacity: 0.65,
    layout: "stack",
    topLabel: { text: "FOODIE MODE", font: F_MONO, color: "#7c2d12" },
    words: [
      { text: "HUNGRY?", color: "#7c2d12", font: F_DISPLAY, size: 130 },
      { text: "same.", color: "#fff", font: F_SERIF, size: 70, italic: true },
    ],
    caption: { text: "tag your fav 👇", font: F_HAND, color: "#7c2d12", size: 34 },
    stickers: [
      { emoji: "🍕", x: 0.15, y: 0.16, size: 76, rot: -18 },
      { emoji: "🍔", x: 0.85, y: 0.22, size: 70, rot: 14 },
      { emoji: "🌮", x: 0.18, y: 0.85, size: 68, rot: -12 },
      { emoji: "🍩", x: 0.82, y: 0.82, size: 66, rot: 22 },
    ],
    enter: "zoomBounce",
  },
  // 4. MOOD
  {
    bg: ["#a855f7", "#ec4899"],
    layout: "center",
    topLabel: { text: "current mood", font: F_HAND, color: "#fff" },
    words: [
      { text: "soft", color: "#fff", font: F_SERIF, size: 90, italic: true },
      { text: "&", color: "#fde047", font: F_SERIF, size: 80, italic: true },
      { text: "unbothered", color: "#fff", font: F_SERIF, size: 90, italic: true },
    ],
    caption: { text: "main character energy", font: F_HAND, color: "#fff", size: 32 },
    stickers: [
      { emoji: "💖", x: 0.15, y: 0.2, size: 70, rot: -12 },
      { emoji: "🦋", x: 0.85, y: 0.25, size: 64, rot: 18 },
      { emoji: "🌸", x: 0.18, y: 0.78, size: 60 },
      { emoji: "💅", x: 0.82, y: 0.8, size: 60, rot: 10 },
    ],
    enter: "wobble",
  },
  // 5. VIBE CHECK
  {
    bg: ["#06b6d4", "#0ea5e9"],
    layout: "center",
    topLabel: { text: "// system status", font: F_MONO, color: "#0c1a3a" },
    words: [
      { text: "VIBE", color: "#fff", font: F_DISPLAY, size: 150 },
      { text: "CHECK", color: "#fde047", font: F_DISPLAY, size: 150 },
      { text: "✓ passed", color: "#0c1a3a", font: F_MONO, size: 42 },
    ],
    stickers: [
      { emoji: "✅", x: 0.15, y: 0.18, size: 68, rot: -10 },
      { emoji: "💯", x: 0.85, y: 0.18, size: 68, rot: 12 },
      { emoji: "🎯", x: 0.5, y: 0.88, size: 72 },
    ],
    enter: "slideUp",
  },
  // 6. BREATHE
  {
    bg: ["#064e3b", "#10b981"],
    hero: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80",
    heroOpacity: 0.55,
    layout: "stack",
    topLabel: { text: "INHALE · EXHALE", font: F_MONO, color: "#a7f3d0" },
    words: [{ text: "breathe", color: "#fff", font: F_SERIF, size: 120, italic: true }],
    caption: { text: "you're doing amazing sweetie", font: F_HAND, color: "#a7f3d0", size: 30 },
    stickers: [
      { emoji: "🌿", x: 0.12, y: 0.22, size: 64, rot: -20 },
      { emoji: "🍃", x: 0.88, y: 0.18, size: 60, rot: 15 },
      { emoji: "🌱", x: 0.15, y: 0.82, size: 58 },
      { emoji: "🦋", x: 0.85, y: 0.78, size: 62, rot: -8 },
    ],
    enter: "wobble",
  },
  // 7. DANCE
  {
    bg: ["#7c3aed", "#f43f5e"],
    layout: "center",
    topLabel: { text: "♪ NOW PLAYING ♪", font: F_MONO, color: "#fde047" },
    words: [
      { text: "DANCE", color: "#fde047", font: F_DISPLAY, size: 160 },
      { text: "like nobody's", color: "#fff", font: F_SERIF, size: 50, italic: true },
      { text: "WATCHING", color: "#fff", font: F_DISPLAY, size: 110 },
    ],
    stickers: [
      { emoji: "💃", x: 0.15, y: 0.5, size: 90, rot: -15 },
      { emoji: "🕺", x: 0.85, y: 0.5, size: 90, rot: 15 },
      { emoji: "🎶", x: 0.5, y: 0.12, size: 60 },
      { emoji: "🪩", x: 0.5, y: 0.88, size: 72 },
    ],
    enter: "spin",
  },
  // 8. NIGHT MODE
  {
    bg: ["#020617", "#1e1b4b"],
    hero: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1200&q=80",
    heroOpacity: 0.45,
    layout: "stack",
    topLabel: { text: "03:47 AM", font: F_MONO, color: "#a5b4fc" },
    words: [
      { text: "NIGHT", color: "#fff", font: F_DISPLAY, size: 130 },
      { text: "MODE", color: "#fbbf24", font: F_DISPLAY, size: 130, italic: true },
    ],
    caption: {
      text: "city lights · headphones · thoughts",
      font: F_HAND,
      color: "#a5b4fc",
      size: 26,
    },
    stickers: [
      { emoji: "🌙", x: 0.85, y: 0.15, size: 72, rot: 12 },
      { emoji: "⭐", x: 0.15, y: 0.2, size: 50, rot: -15 },
      { emoji: "🎧", x: 0.5, y: 0.88, size: 68 },
    ],
    enter: "slideUp",
  },
  // 9. TAG A FRIEND
  {
    bg: ["#fb7185", "#fbbf24"],
    layout: "center",
    topLabel: { text: "→ TAG A FRIEND", font: F_MONO, color: "#7f1d1d" },
    words: [
      { text: "YOU.", color: "#fff", font: F_DISPLAY, size: 170 },
      { text: "yes you.", color: "#7f1d1d", font: F_SERIF, size: 60, italic: true },
      { text: "we're going.", color: "#fff", font: F_DISPLAY, size: 90 },
    ],
    stickers: [
      { emoji: "👯", x: 0.18, y: 0.2, size: 76, rot: -12 },
      { emoji: "💌", x: 0.85, y: 0.22, size: 64, rot: 15 },
      { emoji: "📣", x: 0.5, y: 0.88, size: 72, rot: -8 },
    ],
    enter: "explode",
  },
  // 10. THE END
  {
    bg: ["#000000", "#ff2d75"],
    layout: "center",
    topLabel: { text: "fin.", font: F_HAND, color: "#fff" },
    words: [
      { text: "thanks", color: "#fff", font: F_SERIF, size: 80, italic: true },
      { text: "FOR WATCHING", color: "#fde047", font: F_DISPLAY, size: 110 },
      { text: "see you soon ♡", color: "#fff", font: F_HAND, size: 44, italic: true },
    ],
    caption: { text: "follow for more ✨", font: F_MONO, color: "#fff", size: 22 },
    stickers: [
      { emoji: "💫", x: 0.15, y: 0.18, size: 70, rot: -20 },
      { emoji: "✨", x: 0.85, y: 0.2, size: 64, rot: 18 },
      { emoji: "💖", x: 0.18, y: 0.82, size: 68 },
      { emoji: "🌟", x: 0.82, y: 0.8, size: 64, rot: -10 },
    ],
    enter: "zoomBounce",
  },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const buildScene = (
  comp: Composition,
  scene: Scene,
  index: number,
  width: number,
  height: number,
) => {
  const from = index * SCENE;
  const seq = new Sequence({ from, durationInFrames: SCENE });

  // Background gradient block.
  const bg = new Block({
    x: 0,
    y: 0,
    width,
    height,
    background: {
      gradient: {
        type: "linear",
        angle: 135,
        stops: [
          [0, scene.bg[0]],
          [1, scene.bg[1]],
        ],
      },
    },
  });
  seq.add(bg);

  // Hero image (if any) clipped to stage.
  let heroNode: Image | null = null;
  if (scene.hero) {
    const clipGroup = new Konva.Group({
      x: 0,
      y: 0,
      clipX: 0,
      clipY: 0,
      clipWidth: width,
      clipHeight: height,
    });
    heroNode = new Image({
      src: scene.hero,
      width,
      height,
      objectFit: "cover",
      objectPosition: "center",
      x: width / 2,
      y: height / 2,
      offsetX: width / 2,
      offsetY: height / 2,
      opacity: scene.heroOpacity ?? 0.5,
    });
    clipGroup.add(heroNode);
    seq.add(clipGroup);
  }

  // Top label / handle.
  let topLabelNode: Konva.Text | null = null;
  if (scene.topLabel) {
    topLabelNode = new Konva.Text({
      x: 0,
      y: Math.round(height * 0.08),
      width,
      align: "center",
      text: scene.topLabel.text,
      fontFamily: scene.topLabel.font,
      fontSize: 18,
      fontStyle: "bold",
      fill: scene.topLabel.color,
      letterSpacing: 3,
    });
    seq.add(topLabelNode);
  }

  // Words: one Konva.Text per word, vertically stacked, centered.
  const wordNodes: Konva.Text[] = [];
  const fontScale = Math.min(1, width / 540);
  const sizedWords = scene.words.map((w) => ({ ...w, size: Math.round(w.size * fontScale) }));
  const totalWordH = sizedWords.reduce((s, w) => s + w.size * 1.05, 0);
  let cy = (height - totalWordH) / 2;
  for (const w of sizedWords) {
    const node = new Konva.Text({
      text: w.text,
      x: 0,
      width,
      align: "center",
      fontFamily: w.font,
      fontSize: w.size,
      fontStyle: w.italic ? "italic bold" : "bold",
      fill: w.color,
      y: cy,
      offsetX: 0,
      offsetY: 0,
      opacity: 0,
    });
    // Set origin to center for transforms.
    node.offsetX(width / 2);
    node.offsetY(w.size / 2);
    node.x(width / 2);
    node.y(cy + w.size / 2);
    wordNodes.push(node);
    cy += w.size * 1.05;
  }
  seq.add(...wordNodes);

  // Caption.
  let captionNode: Konva.Text | null = null;
  if (scene.caption) {
    captionNode = new Konva.Text({
      x: 0,
      y: cy + 24,
      width,
      align: "center",
      text: scene.caption.text,
      fontFamily: scene.caption.font,
      fontSize: scene.caption.size,
      fontStyle: "italic",
      fill: scene.caption.color,
      opacity: 0,
    });
    seq.add(captionNode);
  }

  // Stickers (emojis as Konva.Text).
  const stickerNodes: { node: Konva.Text; baseRot: number; baseX: number; baseY: number }[] = [];
  for (const s of scene.stickers) {
    const sx = s.x * width;
    const sy = s.y * height;
    const node = new Konva.Text({
      text: s.emoji,
      fontSize: s.size,
      fontFamily: F_SANS,
      x: sx,
      y: sy,
      offsetX: s.size / 2,
      offsetY: s.size / 2,
      rotation: s.rot ?? 0,
      opacity: 0,
    });
    seq.add(node);
    stickerNodes.push({ node, baseRot: s.rot ?? 0, baseX: sx, baseY: sy });
  }

  // Scene shake amplitude for fast-paced beat-driven motion.
  seq.register((f) => {
    // bg subtle pulse
    const pulse = 1 + 0.02 * Math.sin((f / SCENE) * Math.PI * 4);
    bg.scaleX(pulse);
    bg.scaleY(pulse);
    bg.offsetX((width * (pulse - 1)) / 2 / pulse);
    bg.offsetY((height * (pulse - 1)) / 2 / pulse);

    // Hero Ken Burns + opacity in/out.
    if (heroNode) {
      const s = interpolate(f, [0, SCENE], [1.04, 1.18], { easing: easeInOut });
      heroNode.scaleX(s);
      heroNode.scaleY(s);
      const heroA =
        (scene.heroOpacity ?? 0.5) *
        Math.min(
          interpolate(f, [0, 18], [0, 1], {
            easing: easeOut,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          interpolate(f, [SCENE - 24, SCENE], [1, 0], {
            easing: easeIn,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        );
      heroNode.opacity(heroA);
    }

    // Top label: typewriter in 6..30, fade out 150..180.
    if (topLabelNode && scene.topLabel) {
      const full = scene.topLabel.text;
      const n = Math.round(
        interpolate(f, [6, 30], [0, full.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
      topLabelNode.text(full.slice(0, n));
      const labelA = Math.min(
        interpolate(f, [6, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        interpolate(f, [SCENE - 24, SCENE], [1, 0], {
          easing: easeIn,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
      topLabelNode.opacity(labelA);
    }

    // Words: stagger in & out per-word with entrance variant.
    for (let i = 0; i < wordNodes.length; i++) {
      const node = wordNodes[i];
      if (!node) continue;
      const inStart = 14 + i * 8;
      const inEnd = inStart + 26;
      const outStart = SCENE - 28 - (wordNodes.length - 1 - i) * 4;
      const outEnd = outStart + 24;

      const tIn = interpolate(f, [inStart, inEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const tOut = interpolate(f, [outStart, outEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      // Alpha
      const alpha = tIn * (1 - tOut);
      node.opacity(alpha);

      // Beat wobble: small breathing rotation/scale across idle.
      const beat = 0.5 - 0.5 * Math.cos((f / SCENE) * Math.PI * 2);

      // Apply entrance transform.
      let scaleIn = 1;
      let rotIn = 0;
      let dx = 0;
      let dy = 0;

      const w = sizedWords[i];
      const baseSize = w ? w.size : 80;

      switch (scene.enter) {
        case "explode": {
          const e = easeBack(tIn);
          scaleIn = 0.2 + 0.8 * e;
          rotIn = (i % 2 === 0 ? -1 : 1) * (1 - e) * 15;
          break;
        }
        case "slideUp": {
          const e = easeOut(tIn);
          dy = (1 - e) * 80;
          scaleIn = 0.85 + 0.15 * e;
          break;
        }
        case "slideRight": {
          const e = easeOut(tIn);
          dx = (1 - e) * 160 * (i % 2 === 0 ? 1 : -1);
          scaleIn = 0.9 + 0.1 * e;
          break;
        }
        case "zoomBounce": {
          const e = easeBounce(tIn);
          scaleIn = 0.4 + 0.6 * e;
          break;
        }
        case "spin": {
          const e = easeOut(tIn);
          rotIn = (1 - e) * 90 * (i % 2 === 0 ? -1 : 1);
          scaleIn = 0.5 + 0.5 * e;
          break;
        }
        case "wobble": {
          const e = easeElastic(clamp(tIn, 0, 1));
          scaleIn = 0.7 + 0.3 * e;
          break;
        }
      }

      // Exit transform: float up + scale up.
      const exitE = easeIn(tOut);
      const dyOut = -exitE * 60;
      const scaleOut = 1 + exitE * 0.4;

      // Idle wobble.
      const idleScale = 1 + 0.03 * Math.sin((f / SCENE) * Math.PI * 6 + i);
      const idleRot = 1.5 * Math.sin((f / SCENE) * Math.PI * 4 + i * 0.7) * (1 - tOut);

      const totalScale = scaleIn * scaleOut * idleScale;
      node.scaleX(totalScale);
      node.scaleY(totalScale);
      node.rotation(rotIn + idleRot);

      // Restore center origin and base position.
      node.offsetX(width / 2);
      node.offsetY(baseSize / 2);
      const baseX = width / 2 + dx;
      const baseY = node.y() === 0 ? height / 2 : node.y();
      // Compute baseY once from stored attribute on node.
      const storedY = (node as Konva.Text & { _baseY?: number })._baseY;
      const by = storedY ?? node.y();
      (node as Konva.Text & { _baseY?: number })._baseY = by;
      node.x(baseX);
      node.y(by + dy + dyOut);

      // Tiny beat-driven color flicker on accent words (every other word).
      if (i % 2 === 1) {
        const flick = beat > 0.95 ? 1 : 0;
        node.shadowEnabled(flick > 0);
        if (flick) {
          node.shadowColor("#fff");
          node.shadowBlur(20);
          node.shadowOpacity(0.6);
        }
      }
    }

    // Caption.
    if (captionNode) {
      const a = Math.min(
        interpolate(f, [60, 100], [0, 1], {
          easing: easeOut,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        interpolate(f, [SCENE - 30, SCENE], [1, 0], {
          easing: easeIn,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
      captionNode.opacity(a);
      const bob = Math.sin((f / SCENE) * Math.PI * 8) * 4;
      const baseCY = (captionNode as Konva.Text & { _baseY?: number })._baseY ?? captionNode.y();
      (captionNode as Konva.Text & { _baseY?: number })._baseY = baseCY;
      captionNode.y(baseCY + bob);
    }

    // Stickers: pop in 8..30 (back), float + spin during scene, pop out at end.
    for (let i = 0; i < stickerNodes.length; i++) {
      const s = stickerNodes[i];
      if (!s) continue;
      const inStart = 8 + i * 6;
      const inEnd = inStart + 22;
      const tIn = easeBack(
        interpolate(f, [inStart, inEnd], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
      const tOut = easeIn(
        interpolate(f, [SCENE - 22, SCENE], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
      const scl = tIn * (1 + tOut * 0.5);
      s.node.scaleX(scl);
      s.node.scaleY(scl);
      s.node.opacity(tIn * (1 - tOut));

      const wob = Math.sin((f / SCENE) * Math.PI * 6 + i) * 12;
      const rotWob = Math.sin((f / SCENE) * Math.PI * 4 + i * 1.3) * 8;
      s.node.x(s.baseX);
      s.node.y(s.baseY + wob);
      s.node.rotation(s.baseRot + rotWob);
    }
  });

  comp.add(seq);
};

export const igStoryDemo: DemoDef = {
  id: "ig-story",
  name: "IG Story · 30s",
  build(container, width, height) {
    // Lock to 9:16 portrait, fit within available area.
    const aspect = 9 / 16;
    let w = Math.round(height * aspect);
    let h = height;
    if (w > width) {
      w = width;
      h = Math.round(width / aspect);
    }

    const comp = new Composition({
      id: "ig-story",
      fps: FPS,
      durationInFrames: TOTAL,
      container,
      width: w,
      height: h,
      loop: true,
    });

    for (let i = 0; i < SCENES.length; i++) {
      const s = SCENES[i];
      if (!s) continue;
      buildScene(comp, s, i, w, h);
    }

    return comp;
  },
};
