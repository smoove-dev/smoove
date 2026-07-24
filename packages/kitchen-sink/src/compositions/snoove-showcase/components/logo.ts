/**
 * The smoove logo.
 *
 * The mark's geometry is the 120×120 SVG lifted from the `hello-smoove`
 * composition: four bars the dot pulls open as it sweeps across them. Timings
 * are authored for 30fps rather than halved from the 60fps original — three
 * blinks land better on whole frames than on half ones.
 *
 * One source of truth for the shape: `markStateAt()` computes the mark at a
 * frame in local units, and everything else is a projection of it — the drawn
 * nodes here, and the *punch-out mask* in the video scene, which clips real
 * footage to this exact silhouette. Computed separately, the two would drift
 * apart the moment a timing changed.
 */
import { Circle, Clip, Easing, Group, interpolate, Line, Text } from "@smoove/core";
import { AMBER, CORAL, MUTED, TEAL, TEXT } from "../constants.js";
import { comfortaa } from "../fonts.js";

// -- geometry (SVG units × S) ------------------------------------------------

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
const DOT_R = 3.5;
const STROKE = 9 * S;

/** The mark's visual center, in local px — the origin its group scales about. */
const MARK_CENTER = { x: 64 * S, y: MID };
/** Ink width of the mark: leftmost bar edge → right edge of the parked dot. */
export const MARK_WIDTH = (DOT_HOME + DOT_R - (BARS[0]!.x - 4.5)) * S;

// -- timeline (frames @ 30fps) ----------------------------------------------

const POP_END = 6;
const BLINK = [10, 13, 16, 19, 22, 25, 28];
const GLIDE = [32, 44];
const SWEEP = [44, 70];
const LOCKUP = [70, 80];
const WORD = [78, 108];
const SLOGAN_START = 96;

/** Frame the bars have finished opening. */
export const MARK_SETTLED = SWEEP[1]!;
/** Frame the lockup is fully settled — anchor anything that follows to this. */
export const LOCKUP_SETTLED = WORD[1]!;

// -- the shape, as data ------------------------------------------------------

export type MarkState = {
  /** Capsules: centre x and half-height, in local px. */
  bars: { x: number; half: number; opacity: number }[];
  dot: { x: number; r: number; opacity: number };
  /** Capsule width (the stroke), in local px. */
  strokeW: number;
};

/** The mark at `frame`, in local px. Pure, and the single source of the shape. */
export function markStateAt(frame: number): MarkState {
  const pop = interpolate(frame, [0, POP_END], [0, 1], {
    easing: Easing.out(Easing.back(2)),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blink = interpolate(frame, BLINK, [1, 0.1, 1, 0.1, 1, 0.1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The dot glides left, then sweeps back right pulling each bar open as it
  // passes — reveal is a function of the dot's x, not of the frame, so the
  // bars stay welded to the dot however the sweep is retimed.
  const dotUnitX =
    frame < GLIDE[1]!
      ? interpolate(frame, GLIDE, [DOT_HOME, DOT_LEFT], {
          easing: Easing.inOut(Easing.cubic),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(frame, SWEEP, [DOT_LEFT, DOT_HOME], {
          easing: Easing.inOut(Easing.sin),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const bars = BARS.map(({ x, half }) => {
    const raw =
      frame < SWEEP[0]!
        ? 0
        : interpolate(dotUnitX, [x - 2, x + 9], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
    const pull = Easing.out(Easing.back(1.8))(raw);
    return {
      // Drifts in toward the dot as it reveals.
      x: x * S + (1 - pull) * 5 * S,
      half: half * S * pull,
      opacity: Math.min(1, raw * 3),
    };
  });

  return {
    bars,
    dot: { x: dotUnitX * S, r: DOT_R * S * pop, opacity: blink },
    strokeW: STROKE,
  };
}

/**
 * The mark at `frame` in **stage** coordinates, centred on (`x`, `y`) at
 * `width` px wide. This is what the video scene clips real footage to.
 */
export function markGeometryAt(frame: number, opts: { x: number; y: number; width: number }) {
  const k = opts.width / MARK_WIDTH;
  const st = markStateAt(frame);
  const toX = (lx: number) => opts.x + (lx - MARK_CENTER.x) * k;
  return {
    bars: st.bars.map((b) => ({
      x: toX(b.x),
      half: b.half * k,
      w: st.strokeW * k,
      opacity: b.opacity,
    })),
    dot: { x: toX(st.dot.x), y: opts.y, r: st.dot.r * k, opacity: st.dot.opacity },
  };
}

/** Builds the drawn bars + dot, origin-corrected so the group scales about its centre. */
function buildMark() {
  const group = new Group({ offsetX: MARK_CENTER.x, offsetY: MARK_CENTER.y });

  const gradient = {
    strokeLinearGradientStartPoint: { x: 40 * S, y: MID },
    strokeLinearGradientEndPoint: { x: 84 * S, y: MID },
    strokeLinearGradientColorStops: [0, CORAL, 1, TEAL],
  };

  const bars = BARS.map(() => {
    const node = new Line({
      points: [0, MID, 0, MID],
      strokeWidth: STROKE,
      lineCap: "round",
      opacity: 0,
      listening: false,
      ...gradient,
    });
    group.add(node);
    return node;
  });

  const dot = new Circle({
    x: DOT_HOME * S,
    y: MID,
    radius: DOT_R * S,
    fill: AMBER,
    listening: false,
  });
  group.add(dot);

  const animate = (frame: number) => {
    const st = markStateAt(frame);
    st.bars.forEach((b, i) => {
      const node = bars[i]!;
      node.opacity(b.opacity);
      node.points([b.x, MID - b.half, b.x, MID + b.half]);
    });
    dot.x(st.dot.x);
    dot.radius(Math.max(0.01, st.dot.r));
    dot.opacity(st.dot.opacity);
  };

  return { group, animate };
}

// -- public components -------------------------------------------------------

export type LogoMarkOptions = {
  x: number;
  y: number;
  /** Target ink width in px. */
  width: number;
  from?: number;
  durationInFrames?: number;
};

/** The mark alone, centered on (`x`, `y`) at `width` px wide. */
export function logoMark({ x, y, width, from, durationInFrames }: LogoMarkOptions): Clip {
  const clip = new Clip({ x, y, from, durationInFrames, listening: false });
  const { group, animate } = buildMark();
  const k = width / MARK_WIDTH;
  group.scaleX(k);
  group.scaleY(k);
  clip.add(group);
  clip.register(animate);
  return clip;
}

export type LogoLockupOptions = {
  /** Center of the finished lockup. */
  x: number;
  y: number;
  /** Uniform scale over the tuned 1280-wide design space. */
  scale?: number;
  /** Typed under the wordmark. Omit for the mark + wordmark only. */
  slogan?: string;
  from?: number;
  durationInFrames?: number;
};

/**
 * The full lockup: the mark reveals itself center-stage at 200%, then slides
 * left and settles to 100% to make room for the wordmark, which clip-reveals
 * left → right with the slogan typing underneath.
 *
 * Built in the original 1280×720 design space and re-centered by the wrapping
 * clip, so the tuned relationships between mark, wordmark, and slogan survive
 * being dropped into a 1080² frame at any scale.
 */
export function logoLockup({
  x,
  y,
  scale = 1,
  slogan,
  from,
  durationInFrames,
}: LogoLockupOptions): Clip {
  const DESIGN_W = 1280;
  const STAGE_MID_Y = 320;
  const MARK_FINAL_X = 400;
  const WORDMARK_X = 490;
  const SLOGAN_Y = 360;
  /**
   * Visual center of the settled lockup in design space — the origin the whole
   * lockup is centered on. Taken from a render (mark's left edge to the
   * wordmark's right edge), not from `getClientRect`, which is not reproducible
   * before the face has loaded.
   */
  const DESIGN_CENTER = { x: 626, y: slogan ? 342 : 320 };

  const clip = new Clip({ x, y, from, durationInFrames, listening: false });

  const stage = new Group({
    offsetX: DESIGN_CENTER.x,
    offsetY: DESIGN_CENTER.y,
    scaleX: scale,
    scaleY: scale,
  });
  clip.add(stage);

  const { group: mark, animate: animateMark } = buildMark();
  mark.x(DESIGN_W / 2);
  mark.y(STAGE_MID_Y);
  mark.scaleX(2);
  mark.scaleY(2);
  stage.add(mark);

  // The clip's left edge sits 8px left of the text at rest so the "s" is never
  // cut — the reveal only ever uncovers to the right.
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
    wrap: "none",
    // Stated, and wider than the ink (~380px). Left to size itself, the box
    // lands on its own measurement and a sub-pixel rounding of it ellipsizes
    // the wordmark to "smoo…". The reveal clip is what bounds it visually.
    width: 520,
    x: 0,
    y: -74,
  });
  wordmarkClip.add(wordmark);
  stage.add(wordmarkClip);

  const sloganNode = slogan
    ? new Text({
        // Aligned to the settled wordmark: the "smoove" ink runs from design x
        // 516 for ~415px (measured from a render). Matching the slogan's left
        // edge and box width to that makes the two read as one lockup, the
        // slogan filling exactly the wordmark's width beneath it.
        x: WORDMARK_X + 26,
        y: SLOGAN_Y,
        text: slogan,
        font: comfortaa.face("400"),
        fill: MUTED,
        // Close to the wordmark ink (~415px), with ~20px of headroom so
        // `fitText`'s size choice clears the single-line clamp instead of
        // ellipsizing "play." — a sub-pixel overshoot at exactly 415 trims the
        // last word. A constant, not `wordmark.getClientRect()`: at build time
        // the face may not have loaded, so that read is not reproducible.
        width: 435,
        wrap: "none",
        fitText: { min: 12, max: 100, step: 0.5 },
        typewriter: {
          mode: "letter",
          startFrame: SLOGAN_START,
          durationInFrames: 42,
          cursor: { color: AMBER },
          fade: true,
        },
      })
    : null;
  if (sloganNode) stage.add(sloganNode);

  clip.register((frame) => {
    animateMark(frame);

    // The finished 200% mark slides left and settles at 100%...
    const settle = interpolate(frame, LOCKUP, [0, 1], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    mark.x(DESIGN_W / 2 + (MARK_FINAL_X - DESIGN_W / 2) * settle);
    mark.scaleX(2 - settle);
    mark.scaleY(2 - settle);

    // ...making room for the wordmark: the clip window opens left → right
    // while the text drifts slightly right into place.
    const reveal = interpolate(frame, WORD, [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    wordmarkClip.clipWidth(reveal * 480);
    wordmark.x(reveal * 20);
  });

  return clip;
}
