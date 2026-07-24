/**
 * Shared vocabulary for the showcase: canvas, palette, media URLs, and the
 * handful of geometry constants two scenes have to agree on.
 *
 * Media is imported as a Vite asset URL. `@smoove/vite` rewrites these to
 * absolute filesystem paths in the SSR build, so the same `src` works in the
 * browser player and in the headless renderer.
 */

// -- canvas ------------------------------------------------------------------

export const WIDTH = 1080;
export const HEIGHT = 1080;
export const FPS = 30;

/** Seconds → frames. Durations stay readable and survive an fps change. */
export const sec = (s: number) => Math.round(s * FPS);

/** The slogan, shared so the logo scene and the outro read identically. */
export const SLOGAN = "what you code is what you play.";

// -- palette -----------------------------------------------------------------

export const INK = "#0d1117";
export const CORAL = "#FF5640";
export const TEAL = "#15CDA8";
export const AMBER = "#FFC23C";
export const TEXT = "#e6edf3";
export const MUTED = "#8b949e";
export const PANEL = "#161b22";
export const BORDER = "#2b3440";

// -- media -------------------------------------------------------------------

import bgCode from "./media/video/bg-code.mp4";
import bgEnd from "./media/video/bg-end.mp4";
import bgGreeting from "./media/video/bg-greeting.mp4";
import hero from "./media/video/hero.mp4";

import music from "./media/audio/music.mp3";
import codeTyping from "./media/audio/sfx/code-typing.mp3";
import duckCue from "./media/audio/sfx/duck-cue.mp3";
import greetingBloom from "./media/audio/sfx/greeting-bloom.mp3";
import maskSwish from "./media/audio/sfx/mask-swish.mp3";
import transitionWhoosh from "./media/audio/sfx/transition-whoosh.mp3";
import vo1 from "./media/audio/vo/vo-1.mp3";
import vo2 from "./media/audio/vo/vo-2.mp3";
import vo3 from "./media/audio/vo/vo-3.mp3";
import vo4 from "./media/audio/vo/vo-4.mp3";

import shotEngawa from "./media/images/shot-engawa.jpg";
import shotSchoolyard from "./media/images/shot-schoolyard.jpg";
import shotStreet from "./media/images/shot-street.jpg";
import shotTatami from "./media/images/shot-tatami.jpg";

export const VIDEO = { bgGreeting, bgCode, bgEnd, hero };
export const MUSIC = music;
export const SFX = { greetingBloom, maskSwish, transitionWhoosh, codeTyping, duckCue };
export const VO = { vo1, vo2, vo3, vo4 };

/**
 * The card images, with their real intrinsic aspect ratios. The layout scene
 * reads `aspect` to size each slot — that spread (2.34 → 0.56) is what makes
 * the reflow visible, so it is data, not a magic number in the scene.
 */
export const SHOTS = {
  schoolyard: { src: shotSchoolyard, aspect: 1400 / 598 },
  engawa: { src: shotEngawa, aspect: 1 },
  street: { src: shotStreet, aspect: 782 / 1400 },
  tatami: { src: shotTatami, aspect: 782 / 1400 },
} as const;

// -- shared geometry ---------------------------------------------------------

/**
 * Scene 4's circle mask opens exactly where scene 3's card image sat, so both
 * scenes derive their geometry from this one block rather than from two sets
 * of numbers that can drift apart.
 */
export const CARD = {
  /** Card outer width; centered horizontally. */
  width: 860,
  /** Card top edge — fixed, so the card grows downward and the image never moves. */
  top: 242,
  padding: 28,
  /** Image slot width inside the card. Height comes from each shot's aspect. */
  imageWidth: 280,
  cornerRadius: 24,
} as const;

export const CARD_LEFT = (WIDTH - CARD.width) / 2;
/** Stage-space top-left of the card's image slot. */
export const CARD_IMAGE_X = CARD_LEFT + CARD.padding;
export const CARD_IMAGE_Y = CARD.top + CARD.padding;

/** The shot the card is showing when scene 3 hands off to scene 4. */
export const HANDOFF_SHOT = SHOTS.street;
export const HANDOFF_IMAGE_H = CARD.imageWidth / HANDOFF_SHOT.aspect;

/** Center of that image slot — the origin scene 4's mask grows from. */
export const HANDOFF_CENTER = {
  x: CARD_IMAGE_X + CARD.imageWidth / 2,
  y: CARD_IMAGE_Y + HANDOFF_IMAGE_H / 2,
};
