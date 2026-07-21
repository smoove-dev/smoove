import {
  Block,
  Circle,
  Composition,
  Easing,
  Flex,
  type FrameAnchor,
  Group,
  type HighlightConfig,
  interpolate,
  Line,
  Rect,
  resolveFrameAnchor,
  Sequence,
  Text,
} from "@smoove/core";
import Comfortaa from "@smoove/google-fonts/comfortaa";
// 0.3.0 split the timeline media nodes into @smoove/media.
import { Audio, Video } from "@smoove/media";
import { linearTiming, TransitionSeries, zoomBlur } from "@smoove/transitions";
import Konva from "konva";
// Media lives next to this file and is imported as Vite asset URLs — so the
// whole composition folder is portable (paths resolve relative to the module,
// not against a project-wide `public/`), and @smoove/vite rewrites these to
// filesystem paths for the headless renderer. `new Audio({ src: musicUrl })`
// then works in both the browser player and a server render.
import musicUrl from "./media/audio/music.mp3";
import sfxTypingUrl from "./media/audio/sfx/code-typing.mp3";
import sfxDuckUrl from "./media/audio/sfx/duck-cue.mp3";
// greeting-bloom.mp3 lives in src/media/audio/sfx/ but its cue is commented out
// below — re-add `import sfxBloomUrl from "./media/audio/sfx/greeting-bloom.mp3"`
// when you enable it.
import sfxSwishUrl from "./media/audio/sfx/mask-swish.mp3";
import sfxWhooshUrl from "./media/audio/sfx/transition-whoosh.mp3";
import vo1Url from "./media/audio/vo/vo-1-motion.mp3";
import vo2Url from "./media/audio/vo/vo-2-video.mp3";
import vo3Url from "./media/audio/vo/vo-3-describe.mp3";
import vo4Url from "./media/audio/vo/vo-4-mix.mp3";
import codeBgUrl from "./media/video/bg-code-drift.mp4";
import bgEndVideoUrl from "./media/video/bg-end.mp4";
import greetingBgUrl from "./media/video/bg-greeting-sunrise.mp4";
import heroVideoUrl from "./media/video/hero-astronaut.mp4";
import type { SmooveShowcaseProps } from "./schema";

// ---------------------------------------------------------------------------
// smoove showcase — "One Timeline"
// See docs/superpowers/specs/2026-07-15-smoove-showcase-video-design.md
//
// One canvas, no cuts: every beat is its own Sequence, and consecutive beats
// overlap so scenes morph instead of jumping.
// ---------------------------------------------------------------------------

const fps = 30;
const width = 1080;
const height = 1080;
const durationInFrames = fps * 40; // 1200 — a 40s master

const CX = width / 2;
const CY = height / 2;

const INK = "#07090d"; // near-black base
const ACCENT = "#FFC23C"; // the ident's yellow keyframe dot
const TEXT = "#e6edf3";
const MUTED = "#8b949e";

/** Seconds -> whole frames. Durations stay readable as seconds. */
const s = (sec: number) => Math.round(sec * fps);

const comp = new Composition<SmooveShowcaseProps>({
  id: "smoove-showcase",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
  // `name` defaults to "there" — pass a real one and the greeting renders it.
  props: { greeting: "Hi", name: "there", tagline: "What you code is what you play." },
});
const p = () => comp.props.get();

const comfortaa = new Comfortaa({ weights: ["400", "700"] });

// -- beats -------------------------------------------------------------------
// `from`/`dur` in frames. Neighbours overlap by ~0.5s: that overlap is what
// makes the piece read as one continuous take.
//
// hero -> code -> mix are the exception: they're joined by real shader
// transitions, so they live in one TransitionSeries. A series *shares* the
// overlap rather than adding it, so each `from` after the first is derived from
// the transition lengths instead of being hand-placed.
const HERO_TRANSITION = s(1.2); // 36 frames — hero -> code
const SHADER_TRANSITION = s(0.8); // 24 frames — code -> mix
const HERO_FROM = s(11.8); // 354
// Pulling the code beat earlier does double duty: the hero's length is derived
// from it, so the video ends at 0:18 (from + HERO_TRANSITION = 540), and the
// code beat itself runs 7.6s instead of its original 4.6s. `dur` is then chosen
// so `mix.from` still lands on 708 and the mixer and end card don't move.
const CODE = { from: s(16.8), dur: s(7.6) }; // 504 – 732

// The hero's mask opens from the flex grid's accent tile, measured live off
// that tile (see heroTick). A Sequence only lays its children out while it's
// on-stage, so the flex sequence has to stay active for as long as the mask is
// still measuring — otherwise seeking straight into the reveal reads a tile
// that was never laid out, and the mask opens from (0, 0).
//
// So the flex beat outlives its own visuals: the grid is on screen for
// FLEX_VISIBLE and invisible after, but the sequence keeps ticking (and
// laying out) until the mask is fully open. An opacity-0 layer still reflows.
const MASK_OPEN = [s(0.4), s(2.4)] as const; // hero-local frames
const FLEX_FROM = s(6.9); // 207
const FLEX_VISIBLE = s(5.4); // 162 — grid on screen 207 – 369
const FLEX_DUR = HERO_FROM + MASK_OPEN[1] + 4 - FLEX_FROM; // 223 — ticks to 430

const BEAT = {
  greet: { from: 0, dur: s(3.6) }, //   0 – 108
  ident: { from: s(3), dur: s(4.2) }, //  90 – 216
  flex: { from: FLEX_FROM, dur: FLEX_DUR }, // 207 – 430 (visible 207 – 369)
  // The hero runs all the way to the code beat. It used to stop short and leave
  // a void that a lone sweep flew across — a transition needs a scene on both
  // sides or there's nothing to read it against.
  hero: { from: HERO_FROM, dur: CODE.from - HERO_FROM + HERO_TRANSITION }, // 354 – 540 (ends 0:18)
  code: CODE, // 504 – 732
  // Starts where the shader transition begins eating into the code beat's tail.
  mix: { from: CODE.from + CODE.dur - SHADER_TRANSITION, dur: s(8.4) }, // 708 – 960
  // The end card. It lands at ~0:29 like the rest of the beats and then simply
  // holds to the end of the master — that hold is the extra 10s.
  resolve: { from: s(31.4), dur: s(8.6) }, // 942 – 1200
} as const;

/** A beat's own sequence, already added to the composition. */
const beat = (b: { from: number; dur: number }) => {
  const seq = new Sequence({ from: b.from, durationInFrames: b.dur });
  comp.add(seq);
  return seq;
};

// Voiceover lines (`VO`) are defined further down, after the showcase markers
// they anchor to exist — their `from`s reference showcase.marker(...).

/** Fade a beat's contents in and out at its edges so nothing hard-cuts. */
const crossfade = (local: number, dur: number, inFrames = 10, outFrames = 12) =>
  interpolate(local, [0, inFrames, dur - outFrames, dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

// -- captions ----------------------------------------------------------------
// Only the two beats that can't explain themselves get one: the flex grid (a
// reflowing grid doesn't say *why* on its own) and the mixer.
const CAPTION_Y = height - 190;
const CAPTION_W = 940;
const CAPTION_H = 78;
const CAPTION_RISE = 30;

const captionPlate = (text: string, startFrame: number, typeFor: number) => {
  const box = new Block({
    x: (width - CAPTION_W) / 2,
    y: CAPTION_Y,
    width: CAPTION_W,
    height: CAPTION_H,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    background: "#0b1017d9",
    borderSize: 1,
    borderColor: "#1f2630",
    cornerRadius: 14,
    opacity: 0,
  });
  box.add(
    new Text({
      text,
      font: comfortaa.face("400"),
      fontSize: 30,
      fill: MUTED,
      align: "center",
      width: CAPTION_W - 48, // explicit, like every Text here
      wrap: "none",
      ellipsis: false,
      typewriter: {
        mode: "letter",
        startFrame,
        durationInFrames: typeFor,
        fade: true,
      },
    }),
  );
  const tick = (local: number, gate = 1) => {
    const rise = interpolate(local, [startFrame - s(0.5), startFrame - s(0.05)], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    box.opacity(rise * gate);
    box.y(CAPTION_Y + CAPTION_RISE * (1 - rise));
  };
  return { box, tick };
};

// ===========================================================================
// Base — the background every beat sits on.
// ===========================================================================
const base = new Sequence();
base.add(new Rect({ x: 0, y: 0, width, height, fill: INK, listening: false }));
// Soft radial lift behind the action. A gradient disc, not shadowBlur — blur
// re-runs per frame and dominates the paint cost.
base.add(
  new Circle({
    x: CX,
    y: CY,
    radius: 760,
    fillRadialGradientStartPoint: { x: 0, y: 0 },
    fillRadialGradientEndPoint: { x: 0, y: 0 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: 760,
    fillRadialGradientColorStops: [0, "#141c27", 0.55, "#0b1017", 1, "#07090d00"],
    listening: false,
  }),
);
base.add(comfortaa); // registers the faces with the buffering gate
comp.add(base);

// ===========================================================================
// 0:00–0:03 — Greeting. Dynamic input props + a video backdrop.
// The line is whatever the `name` prop says, pushing slowly bigger.
// ===========================================================================
const greet = beat(BEAT.greet);

const greetBg = new Video({
  x: 0,
  y: 0,
  width,
  height,
  src: greetingBgUrl,
  objectFit: "cover",
  muted: true,
});
greet.add(greetBg);

// Always give Text an explicit width. An unsized Text measures its box once,
// at construction — before the webfont resolves — so the box ends up sized for
// the fallback font and the (wider) Comfortaa glyphs get clipped off the end
// ("Rotem" -> "Rote"). A full-width box with `align: "center"` sidesteps it
// completely: the text centres itself, so nothing here has to measure glyphs.
const GREET_Y = CY - 60;

// The name is whatever the `name` prop holds — it defaults to "there", so the
// line reads "Hi there" until someone passes a name, and then it just *is* the
// name. There's no swap animation: the point is that the prop is the frame, not
// that the frame animates into the prop.
const greetingText = () => `${p().greeting} ${p().name}`;

// The name is tinted with a highlight rather than its own node, because `fill`
// can't be changed after construction and the tint has to follow a prop.
const nameHighlight: HighlightConfig = {
  start: p().greeting.length + 1,
  end: greetingText().length,
  background: "#00000000",
  color: ACCENT,
  progress: 1,
};

const greetLine = new Text({
  text: greetingText(),
  font: comfortaa.face("700"),
  fontSize: 104,
  fill: TEXT,
  align: "center",
  width,
  x: 0,
  y: GREET_Y,
  highlights: [nameHighlight],
});

// Wrapped so the scale has something to pivot around. The offset puts the
// group's origin on the line's optical centre, so growing it pushes outward
// from the middle instead of dragging down and right from (0, 0).
const GREET_MID_Y = GREET_Y + 62;
const greetGroup = new Group({
  x: CX,
  y: GREET_MID_Y,
  offsetX: CX,
  offsetY: GREET_MID_Y,
});
greetGroup.add(greetLine);
greet.add(greetGroup);

// A slow push, held linear on purpose: an eased curve would do most of the
// growing up front and then sit still, which is the opposite of a drift.
const GREET_SCALE = [0.86, 1.14] as const;
let appliedName = p().name;

greet.register((local) => {
  const fade = crossfade(local, BEAT.greet.dur, 12, 16);
  greetBg.opacity(fade * 0.5); // dim: the greeting has to read on top

  greetGroup.opacity(fade);

  const k = interpolate(local, [0, BEAT.greet.dur], [...GREET_SCALE], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  greetGroup.scaleX(k);
  greetGroup.scaleY(k);

  // Re-render if the host pushes a new name.
  const nextName = p().name;
  if (nextName !== appliedName) {
    appliedName = nextName;
    greetLine.setText(greetingText());
    nameHighlight.end = greetingText().length;
  }
});

// ===========================================================================
// The ident. Re-lockup of `smoove-intro-vega` for 1:1. The mark is authored in
// the original 1280x720 space and scaled into the square, so the proven timing
// survives the re-lockup untouched.
//
// Built by a factory because the piece plays it twice — at 0:03 and again on
// the end card. A Konva node has exactly one parent, so the two runs need two
// sets of nodes; sharing one would just move the lockup between sequences.
// ===========================================================================
const K = width / 1280; // 0.84375
const IDENT_DY = 250; // lifts the lockup to the square's optical centre

const S = 2.6;
const MID = 60 * S;
const BARS = [
  { x: 40, half: 22 },
  { x: 52, half: 16 },
  { x: 64, half: 10 },
  { x: 76, half: 4 },
];
const DOT_HOME = 89;
const DOT_LEFT = 28;
const LOGO_CENTER = { x: 64 * S, y: MID };
const STAGE_MID_Y = 320;
const MARK_FINAL_X = 400;
const WORDMARK_X = 490;
const SLOGAN_Y = 360;

// The original ident ran at 60fps; every mark is halved for this 30fps master.
const POP_END = 4;
const BLINK = [6, 7.5, 9, 10.5, 12, 13.5, 15];
const GLIDE = [17, 24];
const SWEEP = [24, 41];
const LOCKUP = [41, 46];
const WORD = [45, 92];
const SLOGAN_START = 60;

const gradient = {
  strokeLinearGradientStartPoint: { x: 40 * S, y: MID },
  strokeLinearGradientEndPoint: { x: 84 * S, y: MID },
  strokeLinearGradientColorStops: [0, "#FF5640", 1, "#15CDA8"],
};

type Ident = { group: Group; tick: (local: number) => void };

/** One playable copy of the ident, mounted on `seq`. */
const buildIdent = (seq: Sequence): Ident => {
  const group = new Group({ x: 0, y: IDENT_DY, scaleX: K, scaleY: K });
  seq.add(group);

  const logo = new Group({
    x: 1280 / 2,
    y: STAGE_MID_Y,
    offsetX: LOGO_CENTER.x,
    offsetY: LOGO_CENTER.y,
    scaleX: 2,
    scaleY: 2,
  });
  group.add(logo);

  const bars = BARS.map(({ x, half }) => {
    const X = x * S;
    const node = new Line({
      points: [X, MID, X, MID],
      strokeWidth: 9 * S,
      lineCap: "round",
      opacity: 0,
      ...gradient,
    });
    logo.add(node);
    return { node, X, unitX: x, half: half * S };
  });

  const dot = new Circle({
    x: DOT_HOME * S,
    y: MID,
    radius: 3.5 * S,
    fill: ACCENT,
    scaleX: 0,
    scaleY: 0,
  });
  logo.add(dot);

  const wordmarkClip = new Group({
    x: WORDMARK_X,
    y: STAGE_MID_Y,
    clip: { x: -8, y: -90, width: 0, height: 180 },
  });
  const wordmark = new Text({
    font: comfortaa.face("700"),
    text: "smoove",
    fontSize: 108,
    fill: TEXT,
    // wrap:none needs a box wide enough for the glyphs, or it trims itself to
    // "smo…". 480 matches the clip window the reveal opens to.
    wrap: "none",
    width: 480,
    x: 0,
    y: -74,
  });
  wordmarkClip.add(wordmark);
  group.add(wordmarkClip);

  const tagline = new Text({
    x: WORDMARK_X + 24,
    y: SLOGAN_Y,
    text: p().tagline,
    font: comfortaa.face("400"),
    fill: MUTED,
    width: 460,
    wrap: "none",
    fitText: { min: 12, max: 100, step: 0.5 },
    typewriter: {
      mode: "letter",
      startFrame: SLOGAN_START,
      durationInFrames: 28,
      cursor: { color: ACCENT },
      fade: true,
    },
  });
  group.add(tagline);

  let appliedTagline = p().tagline;

  const tick = (local: number) => {
    // 1. The dot pops in at 200% and blinks.
    const pop = interpolate(local, [0, POP_END], [0, 1], {
      easing: Easing.out(Easing.back(2)),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    dot.scaleX(pop);
    dot.scaleY(pop);
    dot.opacity(
      interpolate(local, [...BLINK], [1, 0.1, 1, 0.1, 1, 0.1, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );

    // 2. It glides left, then 3. sweeps right, pulling each bar in as it passes.
    const dotUnitX =
      local < GLIDE[1]
        ? interpolate(local, [...GLIDE], [DOT_HOME, DOT_LEFT], {
            easing: Easing.inOut(Easing.cubic),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : interpolate(local, [...SWEEP], [DOT_LEFT, DOT_HOME], {
            easing: Easing.inOut(Easing.sin),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
    dot.x(dotUnitX * S);

    for (const bar of bars) {
      const raw =
        local < SWEEP[0]
          ? 0
          : interpolate(dotUnitX, [bar.unitX - 2, bar.unitX + 9], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
      const pull = Easing.out(Easing.back(1.8))(raw);
      bar.node.opacity(Math.min(1, raw * 3));
      bar.node.points([bar.X, MID - bar.half * pull, bar.X, MID + bar.half * pull]);
      bar.node.x((1 - pull) * 5 * S);
    }

    // 4 + 5. The finished logo slides left and settles at 100%...
    const settle = interpolate(local, [...LOCKUP], [0, 1], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    logo.x(1280 / 2 + (MARK_FINAL_X - 1280 / 2) * settle);
    logo.scaleX(2 - settle);
    logo.scaleY(2 - settle);

    // 6. ...making room for the wordmark's clip reveal.
    const reveal = interpolate(local, [...WORD], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    wordmarkClip.clipWidth(reveal * 480);
    wordmark.x(reveal * 20);

    const nextTagline = p().tagline;
    if (nextTagline !== appliedTagline) {
      appliedTagline = nextTagline;
      tagline.setText(nextTagline);
    }
  };

  return { group, tick };
};

// ===========================================================================
// 0:03–0:07 — The ident plays.
// ===========================================================================
const ident = beat(BEAT.ident);
const identIntro = buildIdent(ident);

ident.register((local) => {
  identIntro.group.opacity(crossfade(local, BEAT.ident.dur, 8, 14));
  identIntro.tick(local);
});

// ===========================================================================
// 0:07–0:12 — Flex layout. The grid reflows live and settles.
// ===========================================================================
const flex = beat(BEAT.flex);

const grid = new Flex({
  x: 0,
  y: 0,
  width,
  height,
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: 22,
  padding: 190,
});
flex.add(grid);

// Shared with the hero's mask: it opens as this exact rounded rect, so the
// radius has to be one number, not two that drift apart.
const TILE_RADIUS = 14;

const tiles: Block[] = [];
const rows: Flex[] = [];
for (let r = 0; r < 3; r++) {
  const row = new Flex({
    width: "100%",
    flexGrow: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "stretch",
    gap: 22,
  });
  for (let c = 0; c < 3; c++) {
    const tile = new Block({
      flexGrow: 1,
      height: "100%",
      cornerRadius: TILE_RADIUS,
      background: {
        gradient: {
          type: "linear",
          stops: [
            [0, "#1b2431"],
            [1, "#111823"],
          ],
          angle: 135,
        },
      },
      borderSize: 1,
      borderColor: "#232e3d",
    });
    tiles.push(tile);
    row.add(tile);
  }
  rows.push(row);
  grid.add(row);
}
// One tile carries the accent — it's the one the hero swells out of.
tiles[4].setAttr("background", {
  gradient: {
    type: "linear",
    stops: [
      [0, "#3a2f12"],
      [1, "#1a1608"],
    ],
    angle: 135,
  },
});
tiles[4].setAttr("borderColor", ACCENT);

const REFLOW = s(2.2); // the justify switch — lands on a downbeat

// The readout above names the props as they move; this names the capability.
const flexCaption = captionPlate("Full CSS flex support.", s(0.8), s(1.0));
flex.add(flexCaption.box);

// The caption says which props; this shows them moving. Without it the grid is
// just tiles shuffling — the numbers are what make it read as *layout*.
const flexReadout = new Text({
  text: "",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 26,
  fill: MUTED,
  align: "center",
  width,
  x: 0,
  y: 132,
  wrap: "none",
  ellipsis: false,
});
flex.add(flexReadout);
let appliedReadout = "";

flex.register((local) => {
  // Visual timing runs off FLEX_VISIBLE, not the sequence's own duration — the
  // sequence deliberately outlives the grid so the mask can keep measuring it.
  const fade = crossfade(local, FLEX_VISIBLE, 12, 16);
  grid.opacity(fade);

  // The reflow is the point. Animating flex *props* lets the engine recompute
  // every slot — the tiles glide. Hand-positioning them would not reflow.
  grid.setAttr(
    "gap",
    interpolate(local, [0, s(1.2), s(3.4)], [4, 34, 22], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  // Bottom is held wider than the top so the tiles clear the caption plate, and
  // the top clears the readout. The hero's mask measures the tile rather than
  // assuming where it is, so it tracks whatever this resolves to.
  const pad = interpolate(local, [0, s(3.4)], [250, 210], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  grid.setAttr("padding", [pad, 190, 300, 190]);

  // Each tile breathes on its own phase, so the grid is always resolving.
  const settle = interpolate(local, [s(2.8), s(4.2)], [1, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Once it has settled, the accent tile starts taking the grid over and the
  // hero swells out of that same slot. Without this the grid froze at s(4.2)
  // and just sat there for the last 1.2s before fading — still on screen, but
  // dead. Now it's moving right up until it's gone, and the handoff to the
  // video reads as cause and effect.
  // Clamped at FLEX_VISIBLE, so once the grid is off screen the tile's box
  // stops moving and the mask has a stable rect to measure for the rest of the
  // reveal.
  const takeover = interpolate(local, [s(4.0), FLEX_VISIBLE], [0, 1], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  tiles.forEach((tile, i) => {
    const wobble = Math.sin(local / 15 + i * 0.8);
    tile.setAttr("flexGrow", 1 + 0.55 * wobble * settle + (i === 4 ? takeover * 7 : 0));
  });
  rows.forEach((row, r) => {
    row.setAttr("flexGrow", 1 + (r === 1 ? takeover * 7 : 0));
  });

  // A discrete align/justify shift on the beat — this one snaps, by design.
  const alignItems = local < REFLOW ? "center" : "stretch";
  grid.setAttr("alignItems", alignItems);

  flexCaption.tick(local, fade);

  // Read the values straight back off the node, so the readout can't drift from
  // the layout it's describing.
  flexReadout.opacity(fade * 0.85);
  const next = `alignItems: "${alignItems}"   gap: ${Math.round(grid.getAttr("gap"))}   flexGrow: ${(
    tiles[4].getAttr("flexGrow") as number
  ).toFixed(2)}`;
  if (next !== appliedReadout) {
    appliedReadout = next;
    flexReadout.setText(next);
  }
});

// ===========================================================================
// 0:12–0:17 — Video + masking. The circle mask opens like a porthole.
// The mask, the clip, and the ident's dot are all the same circle.
// ===========================================================================
// Nodes only — the TransitionSeries further down owns this scene's Sequence.

// Identity transform on purpose: the mask's clipFunc then works in plain stage
// coordinates, which is the space getClientRect() reports the flex tile in. Any
// scale here would have to be undone in the mask maths.
const heroGroup = new Group();

type MaskRect = { x: number; y: number; width: number; height: number };

const heroMask = new Group({
  clipFunc(ctx) {
    // The box is written from register() each frame — still a pure function of
    // the frame, just read at draw time the way Konva wants it. Konva has
    // already called beginPath() and will call clip() after this returns.
    const m = (heroMask.getAttr("maskRect") as MaskRect) ?? {
      x: 0,
      y: 0,
      width,
      height,
    };
    const w = Math.max(0.01, m.width);
    const h = Math.max(0.01, m.height);
    // A rounded rect matching the flex tile, so the tile itself becomes the
    // porthole. Clamp the radius on the way out: while the mask is still small
    // a 14px corner would be a bigger bite than the box has to give.
    const r = Math.min(TILE_RADIUS, w / 2, h / 2);
    ctx.moveTo(m.x + r, m.y);
    ctx.arcTo(m.x + w, m.y, m.x + w, m.y + h, r);
    ctx.arcTo(m.x + w, m.y + h, m.x, m.y + h, r);
    ctx.arcTo(m.x, m.y + h, m.x, m.y, r);
    ctx.arcTo(m.x, m.y, m.x + w, m.y, r);
    ctx.closePath();
  },
});
heroGroup.add(heroMask);

const heroVideo = new Video({
  x: 0,
  y: 0,
  width,
  height,
  src: heroVideoUrl,
  objectFit: "cover",
  muted: true,
  loop: true,
});
heroMask.add(heroVideo);

// -- the word knockout -------------------------------------------------------
// At 0:15 a black plate washes in with the words carved out of it, so the clip
// only survives inside the letters.
//
// It has to be its own *cached* Shape. `destination-out` composites against
// whatever is already on the canvas being drawn into — do it straight onto the
// layer and it erases the video, which is the exact opposite of the effect.
// Cached, the plate gets a private canvas, so the letters cut the plate and the
// video underneath is untouched.
const KNOCKOUT_LINES = ["FAST", "ANYWHERE"];
const KNOCKOUT_W = width * 0.86; // both lines are cut to this exact width
const KNOCKOUT_GAP = 26;
const KNOCKOUT_CAP = 0.72; // cap height as a fraction of font size, for stacking
// Comfortaa's 700 *is* its heaviest face, and it's a light one — it measures
// barely 1% wider than 400. So the weight alone doesn't read as bold at this
// size; stroking the glyphs as well as filling them thickens the cut into
// something that actually looks heavy. Proportional to size, so both lines keep
// the same apparent weight despite being set at different sizes.
const KNOCKOUT_STROKE = 0.055;
const KNOCKOUT_AT = s(2); // hero-local: 354 + 96 = frame 450 = 0:15

const knockout = new Konva.Shape({
  x: 0,
  y: 0,
  width,
  height,
  listening: false,
  opacity: 0,
  sceneFunc: (ctx) => {
    const c = (ctx as unknown as { _context: CanvasRenderingContext2D })._context;
    c.save();
    c.fillStyle = INK;
    c.fillRect(0, 0, width, height);
    c.globalCompositeOperation = "destination-out";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineJoin = "round";
    c.strokeStyle = "#000"; // only the alpha matters under destination-out

    // Set each line to whatever size makes it exactly KNOCKOUT_W wide, so the
    // short word and the long one stack flush instead of one being a stub.
    // Measured, not guessed — the ratio depends entirely on the glyphs.
    const sized = KNOCKOUT_LINES.map((line) => {
      c.font = `700 100px Comfortaa`;
      const w = c.measureText(line).width || 1;
      return { line, size: (KNOCKOUT_W / w) * 100 };
    });

    const heights = sized.map((l) => l.size * KNOCKOUT_CAP);
    const total = heights.reduce((a, b) => a + b, 0) + KNOCKOUT_GAP * (sized.length - 1);
    let y = CY - total / 2;
    sized.forEach((l, i) => {
      c.font = `700 ${l.size}px Comfortaa`;
      c.lineWidth = l.size * KNOCKOUT_STROKE;
      const mid = y + heights[i] / 2;
      c.fillText(l.line, CX, mid);
      c.strokeText(l.line, CX, mid);
      y += heights[i] + KNOCKOUT_GAP;
    });
    c.restore();
  },
});
heroMask.add(knockout);

/**
 * True once Comfortaa's 700 face is really loaded.
 *
 * Not `document.fonts.check()` — that returns true for a family that doesn't
 * exist at all (verified: it says true for "NoSuchFontXYZ"), so it can't tell
 * "loaded" from "never heard of it". Interrogate the face directly instead.
 */
const boldFaceReady = () => {
  if (typeof document === "undefined" || !document.fonts) return true;
  let ready = false;
  document.fonts.forEach((f) => {
    if (
      f.family.replace(/["']/g, "") === "Comfortaa" &&
      f.weight === "700" &&
      f.status === "loaded"
    )
      ready = true;
  });
  return ready;
};

// The cache bakes the glyphs, so baking before the bold face resolves would
// freeze the fallback into the plate forever. Re-bake once, when it lands.
let knockoutFace = "";
const bakeKnockout = () => {
  const face = boldFaceReady() ? "comfortaa-700" : "fallback";
  if (face === knockoutFace) return;
  knockoutFace = face;
  knockout.cache({ x: 0, y: 0, width, height });
};

const heroTick = (local: number) => {
  bakeKnockout();

  // Fade in only: this scene's exit is the shader transition into the code.
  const fade = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  heroGroup.opacity(fade);

  // The mask opens from the accent tile's *measured* box, not from an assumed
  // centre. getClientRect() reports the tile's laid-out bounds in stage
  // coordinates — the flex takeover has been growing that tile, so this is
  // wherever the grid actually handed off, whatever the layout resolved to.
  // No swell on heroGroup any more: the tile itself did the swelling, and the
  // mask picks up exactly where it left it.
  const tile = tiles[4].getClientRect();
  const open = interpolate(local, [...MASK_OPEN], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Grow the tile's own box out to the full frame — one lerp per edge, so the
  // mask is the tile at `open` 0 and the whole canvas at 1.
  const to = (from: number, dest: number) => from + (dest - from) * open;
  heroMask.setAttr("maskRect", {
    x: to(tile.x, 0),
    y: to(tile.y, 0),
    width: to(tile.width, width),
    height: to(tile.height, height),
  });

  // The plate washes in and holds: black creeps over the frame, and the clip is
  // left running inside the letters.
  knockout.opacity(
    interpolate(local, [KNOCKOUT_AT, KNOCKOUT_AT + s(0.4)], [0, 1], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
};

// ===========================================================================
// 0:20–0:24 — Animated code. The value scrubs and the canvas answers.
// ===========================================================================
// Nodes are built here but mounted by the TransitionSeries further down (it
// owns the scene Sequences), so this beat has no `beat()` call of its own.
const codeBg = new Video({
  x: 0,
  y: 0,
  width,
  height,
  src: codeBgUrl,
  objectFit: "cover",
  muted: true,
});

// The canvas half — the frame the code describes.
const STAGE = { x: 290, y: 210, w: 500, h: 300 };
const stage = new Block({
  x: STAGE.x,
  y: STAGE.y,
  width: STAGE.w,
  height: STAGE.h,
  background: "#0b1017",
  borderSize: 1,
  borderColor: "#1f2630",
  cornerRadius: 16,
});

// Sits on the stage, not in it: the rect needs offset origins to spin about its
// own centre, and a flex parent would place its bounding box and let the offset
// drag it off-slot.
const stageRect = new Rect({
  x: STAGE.x + STAGE.w / 2,
  y: STAGE.y + STAGE.h / 2,
  width: 120,
  height: 120,
  fill: ACCENT,
  cornerRadius: 10,
  offsetX: 60,
  offsetY: 60,
});

// The code half.
const panel = new Block({
  x: 290,
  y: 560,
  width: 500,
  height: 260,
  flexDirection: "column",
  justifyContent: "center",
  gap: 8,
  padding: 30,
  background: "#0b1017",
  borderSize: 1,
  borderColor: "#1f2630",
  cornerRadius: 16,
});

const mono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 26,
};
/** A full-width code line. `width` is explicit, so wrap:none can't trim it. */
const codeLine = (text: string, fill: string, startFrame: number) =>
  new Text({
    text,
    ...mono,
    fill,
    wrap: "none",
    width: "100%",
    typewriter: {
      mode: "letter",
      startFrame,
      durationInFrames: 14,
      fade: true,
    },
  });

panel.add(codeLine("new Rect({", MUTED, s(0.6)));
panel.add(codeLine('  fill: "#FFC23C",', "#7ee787", s(1.2)));

// The scrubbing line. One Text, not a label + value row: a nested Flex inside
// this Block never gets placed by the column pass and lands back at its
// parent's origin, on top of the other lines. The number is tinted with a
// highlight instead, and rewritten with setText as it scrubs — so no
// typewriter here, since setText would restart the reveal every frame.
const SCRUB_PREFIX = "  rotation: ";
const valueHighlight: HighlightConfig = {
  start: SCRUB_PREFIX.length,
  end: SCRUB_PREFIX.length + 1,
  background: "#00000000",
  color: ACCENT,
  progress: 1,
};
const scrubLine = new Text({
  text: `${SCRUB_PREFIX}0,`,
  ...mono,
  fill: MUTED,
  width: "100%",
  wrap: "none",
  highlights: [valueHighlight],
  opacity: 0,
});
panel.add(scrubLine);
panel.add(codeLine("})", MUTED, s(2.4)));

let appliedValue = "";

const codeTick = (local: number) => {
  // No crossfade at all: a shader transition sits on *both* edges of this
  // scene, and each already blends it on/off. Fading here too would dim every
  // element inside the blend.
  const fade = 1;
  stage.opacity(fade);
  panel.opacity(fade);

  // One value scrubs; the canvas answers in sync. Same number, both sides.
  //
  // It runs up, past, and back rather than sliding once to a stop: the beat is
  // 8.6s now, and a single ease would finish early and leave the panel sitting
  // there for half its length. Overshooting and settling reads like a hand
  // dragging the value, which is the point of the shot.
  const spin = interpolate(local, [s(2.4), s(4.0), s(5.4), s(6.9)], [0, 135, 28, 96], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  stageRect.rotation(spin);
  stageRect.opacity(fade);
  scrubLine.opacity(
    fade *
      interpolate(local, [s(1.8), s(2.2)], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
  );

  const next = `${Math.round(spin)}`;
  if (next !== appliedValue) {
    appliedValue = next;
    scrubLine.setText(`${SCRUB_PREFIX}${next},`);
    // Re-aim the tint at the new digits. The Text is a Block child, so the
    // layout pass re-reads the config each tick — no manual _layoutText().
    valueHighlight.end = SCRUB_PREFIX.length + next.length;
  }
};

// ===========================================================================
// 0:24–0:29 — Sound mixing. The meters read the same volume signals you hear.
// ===========================================================================
// Same as the code beat: nodes now, mounted by the TransitionSeries below.
// The greeting's backdrop returns here, run much darker than at 0:00 (0.5) —
// it bookends the piece without pulling focus off the meters.
const mixBg = new Group({
  width,
  height,
  x: 0,
  y: 0,
});

const mixBgVideo = new Video({
  x: 0,
  y: 0,
  width,
  height,
  src: bgEndVideoUrl,
  objectFit: "cover",
  muted: true,
  loop: true,
  // Dim from construction, not just from the first tick — the shader
  // transition samples this layer before any updater has run for it.
  opacity: 1,
});
mixBg.add(mixBgVideo);

// -- the mixer console -------------------------------------------------------
// Three channel strips, each with a segmented LED meter, a peak-hold, a fader
// and the name of the clip currently playing on it. The meters read each Audio
// node's decoded loudness envelope (node.rmsAt/peakAt, introspect: true),
// scaled by that channel's fader — so a bar moves because the audio moves, not
// because a sine wave says so.
const STRIP_W = 240;
const STRIP_H = 500;
const STRIP_GAP = 30;
const STRIP_Y = 200;
const STRIP_X0 = (width - (STRIP_W * 3 + STRIP_GAP * 2)) / 2;

const SEGMENTS = 16;
const SEG_H = 17;
const SEG_GAP = 4.4;
const METER_TOP = 62; // strip-local
const METER_BOTTOM = METER_TOP + SEGMENTS * SEG_H + (SEGMENTS - 1) * SEG_GAP; // 400
const FADER_TRAVEL = METER_BOTTOM - METER_TOP;
const KNOB_H = 20;

/** Teal -> yellow -> red: the ident's own gradient, read as a meter. */
const segColor = (i: number) => {
  const t = i / (SEGMENTS - 1);
  if (t < 0.6) return "#15CDA8";
  if (t < 0.85) return ACCENT;
  return "#FF5640";
};

const meterNodes: (Group | Konva.Shape)[] = [];
const strips = ["music", "voice", "fx"].map((label, i) => {
  const sx = STRIP_X0 + i * (STRIP_W + STRIP_GAP);

  meterNodes.push(
    new Block({
      x: sx,
      y: STRIP_Y,
      width: STRIP_W,
      height: STRIP_H,
      background: "#0b1017cc",
      borderSize: 1,
      borderColor: "#1f2630",
      cornerRadius: 14,
    }),
  );
  meterNodes.push(
    new Text({
      x: sx,
      y: STRIP_Y + 18,
      width: STRIP_W,
      align: "center",
      text: label.toUpperCase(),
      font: comfortaa.face("700"),
      fontSize: 22,
      fill: TEXT,
      letterSpacing: 3,
    }),
  );

  const segs: Rect[] = [];
  for (let k = 0; k < SEGMENTS; k++) {
    const seg = new Rect({
      x: sx + 30,
      y: STRIP_Y + METER_BOTTOM - k * (SEG_H + SEG_GAP) - SEG_H,
      width: 66,
      height: SEG_H,
      fill: segColor(k),
      cornerRadius: 3,
      opacity: 0.1,
    });
    segs.push(seg);
    meterNodes.push(seg);
  }

  // Peak hold — the max of the last PEAK_HOLD frames, so it's still a pure
  // function of the frame and survives scrubbing.
  const peak = new Rect({
    x: sx + 30,
    y: STRIP_Y + METER_BOTTOM,
    width: 66,
    height: 3,
    fill: TEXT,
    opacity: 0,
    cornerRadius: 2,
  });
  meterNodes.push(peak);

  const faderX = sx + 158;
  meterNodes.push(
    new Rect({
      x: faderX + 24,
      y: STRIP_Y + METER_TOP,
      width: 4,
      height: FADER_TRAVEL,
      fill: "#1f2630",
      cornerRadius: 2,
    }),
  );
  const knob = new Rect({
    x: faderX,
    y: STRIP_Y + METER_BOTTOM - KNOB_H / 2,
    width: 52,
    height: KNOB_H,
    fill: "#2b3644",
    stroke: "#46536604",
    strokeWidth: 1,
    cornerRadius: 4,
  });
  meterNodes.push(knob);

  const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
  // What's actually playing on this channel, and where the fader is sitting.
  const clip = new Text({
    x: sx + 8,
    y: STRIP_Y + 418,
    width: STRIP_W - 16,
    align: "center",
    text: "idle",
    ...mono,
    fontSize: 17,
    fill: MUTED,
    wrap: "none",
    ellipsis: false,
  });
  const db = new Text({
    x: sx,
    y: STRIP_Y + 452,
    width: STRIP_W,
    align: "center",
    text: "0.0 dB",
    ...mono,
    fontSize: 19,
    fill: ACCENT,
    wrap: "none",
    ellipsis: false,
  });
  meterNodes.push(clip, db);

  return { segs, peak, knob, clip, db, appliedClip: "", appliedDb: "" };
});

const mixCaption = captionPlate("Music, voice and effects. Mixed on the timeline.", s(1.8), s(1.6));
meterNodes.push(mixCaption.box);

// ===========================================================================
// The hero -> code -> mix TransitionSeries, declared here (before the audio)
// so its markers exist when the cues below anchor to them. `scene(build)` only
// *stores* each builder — they run at comp.add(showcase), far below, by which
// point mixTick and the rest are defined (the mix builder forward-references
// mixTick; legal because the closure isn't invoked until then).
//
// zoomBlur() is Tier B (GLSL): both layers are captured as textures and blended
// by a fragment shader each frame. WebGL2 in the browser; 0.3.1 also runs it
// headless (WebGL1 via headless-gl) for server render.
// ===========================================================================
const showcase = new TransitionSeries({
  // Our composition types its `props`; the series' option is the untyped
  // default, so widen it — same cast main.ts makes for the player.
  composition: comp as unknown as Composition,
  from: BEAT.hero.from,
});
showcase.scene({ durationInFrames: BEAT.hero.dur, name: "hero" }, (seq) => {
  seq.add(heroGroup);
  seq.register(heroTick);
});
showcase.transition({
  presentation: zoomBlur(),
  timing: linearTiming({ durationInFrames: HERO_TRANSITION }),
});
showcase.scene({ durationInFrames: BEAT.code.dur, name: "code" }, (seq) => {
  seq.add(codeBg, stage, stageRect, panel);
  seq.register(codeTick);
});
showcase.transition({
  presentation: zoomBlur(),
  timing: linearTiming({ durationInFrames: SHADER_TRANSITION }),
});
showcase.scene({ durationInFrames: BEAT.mix.dur, name: "mix" }, (seq) => {
  seq.add(mixBg, ...meterNodes);
  seq.register(mixTick);
});

// Markers resolve live off the series' placement — retiming a scene moves every
// cue anchored here. `.start` on a TransitionSeries scene is where its incoming
// transition begins (so code.start == the hero->code blend, mix.start == the
// code->mix blend). This is the shipped form of what was a hand-derived
// BEAT.x.from + offset last release, before @smoove/core 0.3.1 added markers.
const heroMarker = showcase.marker("hero");
const codeMarker = showcase.marker("code");
const mixMarker = showcase.marker("mix");

// Voiceover lines, each anchored to the scene it plays over — `.start` is where
// that scene's incoming transition begins, so retiming a scene carries its line.
// VO1 sits in the greeting/ident region (no showcase scene there), so it keeps a
// plain frame. `from` is a FrameAnchor: the Audio Sequence takes it live, while
// the duck maths below resolves it to a number.
// `src` is the imported asset URL; `name` is the human label the mixer shows
// (the imported URL is hashed at build, so it can't stand in for the filename).
const VO: { from: FrameAnchor; dur: number; src: string; name: string }[] = [
  { from: s(4), dur: s(4.36), src: vo1Url, name: "vo-1-motion.mp3" },
  { from: heroMarker.start.add(s(1.2)), dur: s(4.1), src: vo2Url, name: "vo-2-video.mp3" },
  { from: codeMarker.start.add(s(4.2)), dur: s(3.45), src: vo3Url, name: "vo-3-describe.mp3" },
  // Sits mid-mixer, not at its head: the meters get to run on music + fx first,
  // so the duck is something you watch happen rather than arrive into.
  { from: mixMarker.start.add(60), dur: s(4), src: vo4Url, name: "vo-4-mix.mp3" },
];

// ===========================================================================
// Audio. Music, voice and effects each mount as an Audio node; the music's
// volume is a signal, animated frame by frame. That animation IS the duck. Each
// node is built with `introspect: true` so the mixer meters can read its real
// decoded loudness (rmsAt/peakAt) — what you see is literally what you hear.
// ===========================================================================
const MUSIC_BED = 1;
const MUSIC_DUCKED = 0.5;

// `introspect: true` decodes each clip's loudness envelope up front, so the
// mixer meters can call node.rmsAt()/peakAt() and read the *real* sound — no
// more baking RMS into a generated file with an ffmpeg script (0.3.0's
// @smoove/media shipped exactly the audio-introspection API this composition
// used to fake). Refs kept so the mixer can reach each node and its `from`.
type AudioTrack = { node: Audio; from: number; dur: number; name: string };
const voTracks: AudioTrack[] = VO.map((line) => {
  const node = new Audio({ src: line.src, volume: 2, introspect: true });
  // Sequence takes the live anchor; the record keeps a number for the mixer.
  const seq = new Sequence({ from: line.from, durationInFrames: line.dur });
  seq.add(node);
  comp.add(seq);
  return { node, from: resolveFrameAnchor(line.from), dur: line.dur, name: line.name };
});

// Short one-shots. Every source file carries a long tail, so each is trimmed
// to its hit — otherwise a 6s whoosh rings on into the next beat.
// NOTE: the flex-tile snap (0:08–0:10) is absent — public/audio/sfx/flex-snap.mp3
// was never sourced. Add the file and a cue here once it exists.
// `lead` is the silence at the head of each file, measured with ffmpeg
// silencedetect — these are generated one-shots and most of them don't start on
// the sound. Without trimming past it, a short cue spends its whole window
// playing the file's own silence and you hear nothing. `dur` is then how much
// of the sound to actually play, and doubles as the meter's activity window.
//
// Each cue's `from` is a showcase marker + offset — the two whooshes ride the
// actual transitions (code/mix `.start`) and the typing sits under the code, so
// retiming a scene carries them with it instead of silently desyncing (which it
// did, twice, back when these were hand-typed frames). Levels are set against the
// music (~-18.7 dB); mask-swish and code-typing were 13 and 18 dB under it, so
// both files were re-encoded with makeup gain (0.3.0's `volume` can now exceed
// 1, so new quiet cues can be lifted here instead — these were already baked).
const SFX: {
  from: FrameAnchor;
  dur: number;
  lead: number;
  src: string;
  name: string;
  volume: number;
}[] = [
  // { from: s(1), dur: s(1.2), lead: 0, src: sfxBloomUrl, name: "greeting-bloom.mp3", volume: 0.7 },
  {
    from: heroMarker.start.add(s(1.2)), // rides the mask reveal
    dur: s(1.0),
    lead: s(0.31),
    src: sfxSwishUrl,
    name: "mask-swish.mp3",
    volume: 0.9,
  },
  {
    from: codeMarker.start, // rides the hero -> code blend
    dur: s(1.4),
    lead: s(0.22),
    src: sfxWhooshUrl,
    name: "transition-whoosh.mp3",
    volume: 0.7,
  },
  {
    from: codeMarker.start.add(s(0.6)), // under the code lines typing
    dur: s(3),
    lead: s(0.44),
    src: sfxTypingUrl,
    name: "code-typing.mp3",
    volume: 0.8,
  },
  {
    from: mixMarker.start, // rides the code -> mix blend
    dur: s(1.4),
    lead: s(0.22),
    src: sfxWhooshUrl,
    name: "transition-whoosh.mp3",
    volume: 0.7,
  },
  {
    from: mixMarker.start.add(s(3.8)), // lands with VO4, under the duck
    dur: s(0.8),
    lead: 0,
    src: sfxDuckUrl,
    name: "duck-cue.mp3",
    volume: 0.3,
  },
];

type FxTrack = AudioTrack & { volume: number };
const fxTracks: FxTrack[] = SFX.map((fx) => {
  // trimBefore skips the file's leading silence; trimAfter is an absolute bound
  // in media frames, so it has to include the lead, not just the play length.
  const node = new Audio({
    src: fx.src,
    volume: fx.volume,
    trimBefore: fx.lead,
    trimAfter: fx.lead + fx.dur,
    introspect: true,
  });
  // The Sequence gets the live anchor (marker resolves on every read); the
  // track record keeps a resolved number because the mixer does frame
  // arithmetic on it (`frame - track.from` for the local frame into rmsAt).
  const seq = new Sequence({ from: fx.from, durationInFrames: fx.dur });
  seq.add(node);
  comp.add(seq);
  return { node, from: resolveFrameAnchor(fx.from), dur: fx.dur, name: fx.name, volume: fx.volume };
});

// The source track is 2:24; the 30s the piece uses starts here. Frames, at the
// composition's fps — so this is 0:25 into the file, playing to 0:55.
const MUSIC_START = s(21);
// Entering 25s in means landing mid-groove at full energy, so the track fades
// up rather than slamming in on frame 0.
const MUSIC_FADE_IN = s(2);
// ...and out again under the end card, reaching silence a beat before the last
// frame rather than exactly on it, so the piece ends on quiet rather than on a
// cut. The source is 2:24 long, so there is plenty of track left to fade.
const MUSIC_FADE_OUT = [s(33), s(39)] as const;
const music = new Audio({
  src: musicUrl,
  volume: MUSIC_BED,
  loop: false,
  trimBefore: MUSIC_START,
  introspect: true,
});
const musicSeq = new Sequence();
musicSeq.add(music);
comp.add(musicSeq);
// The music node spans the whole timeline; its local frame IS the comp frame.
const musicTrack: AudioTrack = {
  node: music,
  from: 0,
  dur: durationInFrames,
  name: "music.mp3",
};

/**
 * The duck: music dips under each voiceover line and swells back after it,
 * between a fade-in at the top of the piece and a fade-out under the end card.
 */
const musicVolumeAt = (frame: number) => {
  let gain = 1;
  for (const line of VO) {
    const a = resolveFrameAnchor(line.from); // marker -> frame for the duck window
    const b = a + line.dur;
    gain = Math.min(
      gain,
      interpolate(frame, [a - 9, a + 5, b - 5, b + 14], [1, 0, 0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  }
  const level = MUSIC_DUCKED + (MUSIC_BED - MUSIC_DUCKED) * gain;
  // Both fades multiply in, so they scale whatever the duck is doing rather
  // than fighting it. The in is done well before the first line at 0:04; the
  // out starts long after the last one ends.
  const fadeIn = interpolate(frame, [0, MUSIC_FADE_IN], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Linear on purpose: an eased curve holds the music loud and then drops it,
  // which reads as a cut rather than a fade.
  const fadeOut = interpolate(frame, [...MUSIC_FADE_OUT], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return level * fadeIn * fadeOut;
};

musicSeq.register((frame) => {
  music.setVolume(musicVolumeAt(frame));
});

// -- what each channel is doing, at any frame --------------------------------
const PEAK_HOLD = 18; // frames the peak marker lingers

/** RMS -> 0..1 across a -54..0 dB scale, the way a real meter is spaced. */
const meterFromRms = (rms: number) => {
  if (rms <= 0.0005) return 0;
  const db = 20 * Math.log10(rms);
  // interpolate's own clamp rather than a hand-rolled Math.max/min remap.
  return interpolate(db, [-54, 0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

const dbLabel = (gain: number) =>
  gain <= 0.002 ? "-inf" : `${(20 * Math.log10(gain)).toFixed(1)} dB`;

type ChannelState = {
  meter: number;
  peak: number;
  fader: number;
  clip: string;
};

/**
 * A channel's state, read straight off the Audio node's decoded envelope.
 * `rmsAt`/`peakAt` are pre-fader (the clip's real loudness) and take a
 * *sequence-local* frame, mapping it to media time — trims, lead and all —
 * internally. So we pass `frame - track.from` and multiply by the fader
 * ourselves, exactly as the docs prescribe.
 */
const readChannel = (
  track: AudioTrack | undefined,
  frame: number,
  fader: number,
  idleFader: number,
): ChannelState => {
  if (!track) return { meter: 0, peak: 0, fader: idleFader, clip: "idle" };
  const local = frame - track.from;
  return {
    meter: meterFromRms(track.node.rmsAt(local) * fader),
    peak: meterFromRms(track.node.peakAt(local, { holdFrames: PEAK_HOLD }) * fader),
    fader,
    clip: track.name,
  };
};

const active = (tracks: AudioTrack[], frame: number) =>
  tracks.find((t) => frame >= t.from && frame < t.from + t.dur);

const channelStates = (frame: number): ChannelState[] => {
  // music — always playing; its fader is the duck automation itself.
  const music = readChannel(musicTrack, frame, musicVolumeAt(frame), MUSIC_BED);
  // voice — whichever line is speaking, if any. Volume is 1.
  const voice = readChannel(active(voTracks, frame), frame, 1, 1);
  // effects — whichever cue is firing, if any. Its fader is the cue volume.
  const fxTrack = fxTracks.find((t) => frame >= t.from && frame < t.from + t.dur);
  const fx = readChannel(fxTrack, frame, fxTrack?.volume ?? 0.7, 0.7);
  return [music, voice, fx];
};

const mixTick = (local: number) => {
  const frame = BEAT.mix.from + local;
  // No fade *in*: the shader transition already blends this scene on, so
  // ramping opacity here too would dim every element on the way in and leave
  // the backdrop bright-then-dark instead of dark throughout. Only the tail
  // crossfades, into the end card.
  const fade = interpolate(local, [BEAT.mix.dur - 16, BEAT.mix.dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // The backdrop is the only thing dimmed, and it's held at MIX_BG_DIM for the
  // whole scene — the console plays at full opacity over it.
  mixBg.opacity(fade);
  mixCaption.tick(local, fade);

  const states = channelStates(frame);
  strips.forEach((strip, i) => {
    const st = states[i];
    const lit = st.meter * SEGMENTS;
    strip.segs.forEach((seg, k) => {
      // A segment is on once the level reaches it; the last one part-lights so
      // the meter moves smoothly instead of stepping.
      const on = Math.max(0, Math.min(1, lit - k));
      seg.opacity(fade * (0.1 + 0.9 * on));
    });

    const peakY = STRIP_Y + METER_BOTTOM - st.peak * (METER_BOTTOM - METER_TOP);
    strip.peak.y(peakY);
    strip.peak.opacity(st.peak > 0.02 ? fade * 0.9 : 0);

    strip.knob.y(STRIP_Y + METER_BOTTOM - st.fader * FADER_TRAVEL - KNOB_H / 2);
    strip.knob.opacity(fade);

    // setText re-lays out, so only touch it when the text actually changed.
    if (st.clip !== strip.appliedClip) {
      strip.appliedClip = st.clip;
      strip.clip.setText(st.clip);
    }
    const db = dbLabel(st.fader);
    if (db !== strip.appliedDb) {
      strip.appliedDb = db;
      strip.db.setText(db);
    }
    strip.clip.opacity(fade * (st.clip === "idle" ? 0.35 : 0.9));
    strip.db.opacity(fade * 0.9);
  });
};

// ===========================================================================
// 0:12–0:29 — Hero, code and mix, joined by real shader transitions.
//
// These three are the only scenes not joined by a plain opacity overlap, so a
// TransitionSeries mounts them: it builds each scene Sequence plus the GL
// overlay that blends them. Added here, after the audio helpers exist, because
// `sequences()` runs the scene builders eagerly and `mixTick` closes over
// `musicVolumeAt`.
//
// The series *shares* each overlap rather than adding it, so the whole run
// still lands on the same frames as before: 354 -> 630 (hero), 594 -> 732
// (code), 708 -> 870 (mix).
//
// `zoomBlur()` is Tier B (GLSL): each frame both layers are captured as
// textures and blended by a fragment shader. It needs a WebGL2 context — with
// none it silently falls back to fade(), and rendering it headlessly needs
// extra wiring.
// ===========================================================================
comp.add(showcase);

// ===========================================================================
// 0:29–0:40 — The end card. Everything collapses back into the ident, which
// builds itself a second time, and the call to action rises under it.
// ===========================================================================
const resolve = beat(BEAT.resolve);
const identOutro = buildIdent(resolve);

const CTA_TEXT = "go to smoove.dev to learn more";
const CTA_URL = "smoove.dev";
// Tint just the domain. `fill` is fixed at construction, so a highlight with a
// transparent background is how one run of a Text gets its own colour.
const ctaHighlight: HighlightConfig = {
  start: CTA_TEXT.indexOf(CTA_URL),
  end: CTA_TEXT.indexOf(CTA_URL) + CTA_URL.length,
  background: "#00000000",
  color: ACCENT,
  progress: 1,
};
const cta = new Text({
  text: CTA_TEXT,
  font: comfortaa.face("400"),
  fontSize: 40,
  fill: MUTED,
  align: "center",
  width,
  x: 0,
  y: 700,
  highlights: [ctaHighlight],
  opacity: 0,
});
resolve.add(cta);

// The ident's own reveal runs to ~frame 92, so the CTA waits for the lockup to
// finish rather than competing with it.
const CTA_IN = [s(3.4), s(4.2)] as const;

resolve.register((local) => {
  identOutro.group.opacity(
    interpolate(local, [0, s(0.4)], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  identOutro.tick(local);

  const rise = interpolate(local, [...CTA_IN], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  cta.opacity(rise);
  cta.y(716 - 16 * rise); // drifts up as it fades in
});

export default comp;
