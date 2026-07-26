import { Circle, Composition, Easing, interpolate, Line, Rect, Sequence, Text } from "@smoove/core";
import Comfortaa from "@smoove/google-fonts/comfortaa";
import Konva from "konva";

/**
 * Introduction hero: the smoove logo builds itself. A dot pops in, blinks,
 * glides left, then sweeps back across the bars and pulls each one open as it
 * passes. The finished mark slides aside, the wordmark clip-reveals, and the
 * slogan types underneath.
 *
 * Every value is a pure function of the frame: no timers, no tweens. This is
 * the same composition `npm create smoove` scaffolds as `hello-smoove`, so the
 * docs hero and the starter project stay in step.
 */
const fps = 60;
const durationInFrames = fps * 4;
const width = 1280;
const height = 720;

const SLOGAN = "What you code is what you play.";

const comp = new Composition({
  id: "hero",
  fps,
  durationInFrames,
  width,
  height,
  loop: true,
});

// The wordmark font. Registered on the sequence below so the composition
// buffers until the faces are loaded.
const comfortaa = new Comfortaa({ weights: ["400", "700"] });

const main = new Sequence({ from: 0, durationInFrames });
// Full-size background. Keep one: exports and renders composite onto it, and
// without it the output background differs from the page behind the player.
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
main.add(comfortaa);

// ---------------------------------------------------------------------------
// Geometry. The mark is drawn in its 120×120 SVG units scaled by S (= 100%),
// inside a group whose origin sits at the mark's visual center, so scaling the
// group scales the logo about its center.
// ---------------------------------------------------------------------------
const S = 2.6;
const MID = 60 * S; // vertical center of the mark, in local px
const BARS = [
  { x: 40, half: 22 },
  { x: 52, half: 16 },
  { x: 64, half: 10 },
  { x: 76, half: 4 },
];
const DOT_HOME = 89; // SVG-unit x the dot parks at
const DOT_LEFT = 28; // where it glides to before the reveal sweep

const LOGO_CENTER = { x: 64 * S, y: MID }; // local px of the mark's center
const STAGE_MID_Y = 320;
const MARK_FINAL_X = 400; // lockup: mark center once it has made room
const WORDMARK_X = 490; // lockup: clear of the mark even mid-slide
const SLOGAN_Y = 360; // right below the wordmark

// -- timeline (frames) -------------------------------------------------------
const POP_END = 8; // dot pops in at 200%
const BLINK = [12, 15, 18, 21, 24, 27, 30] as const; // three blinks
const GLIDE = [34, 48] as const; // dot glides to the left
const SWEEP = [48, 82] as const; // dot crosses the bars, pulling them in
const LOCKUP = [82, 92] as const; // logo slides left, scales 200% -> 100%
const WORD = [90, 184] as const; // wordmark clip-reveals left -> right, after the mark clears it
const SLOGAN_START = 120; // slogan starts typing

// ---------------------------------------------------------------------------
// The logo: bars + dot in one group, born at 200% in the stage center.
// ---------------------------------------------------------------------------
const logo = new Konva.Group({
  x: width / 2,
  y: STAGE_MID_Y,
  offsetX: LOGO_CENTER.x,
  offsetY: LOGO_CENTER.y,
  scaleX: 2,
  scaleY: 2,
});
main.add(logo);

const gradient = {
  strokeLinearGradientStartPoint: { x: 40 * S, y: MID },
  strokeLinearGradientEndPoint: { x: 84 * S, y: MID },
  strokeLinearGradientColorStops: [0, "#FF5640", 1, "#15CDA8"],
};

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
  fill: "#FFC23C",
  scaleX: 0,
  scaleY: 0,
});
logo.add(dot);

// ---------------------------------------------------------------------------
// The wordmark, behind a clip window that opens left -> right.
// ---------------------------------------------------------------------------
// The clip's left edge sits 8px left of the text at rest, so the "s" is never
// cut: the reveal only ever uncovers to the right.
const wordmarkClip = new Konva.Group({
  x: WORDMARK_X,
  y: STAGE_MID_Y,
  clip: { x: -8, y: -90, width: 0, height: 180 },
});
const wordmark = new Text({
  font: comfortaa.face("700"),
  text: "smoove",
  fontSize: 108,
  fill: "#e6edf3",
  wrap: "none",
  x: 0,
  y: -74,
});
wordmarkClip.add(wordmark);
main.add(wordmarkClip);

// ---------------------------------------------------------------------------
// The slogan, typed out under the lockup.
// ---------------------------------------------------------------------------
// Fit-to-box: a long slogan shrinks to stay on one line instead of growing
// past the lockup.
const slogan = new Text({
  x: WORDMARK_X + 24,
  y: SLOGAN_Y,
  text: SLOGAN,
  font: comfortaa.face("400"),
  fill: "#8b949e",
  width: wordmark.getClientRect().width,
  wrap: "none",
  fitText: { min: 12, max: 100, step: 0.5 },
  typewriter: {
    mode: "letter",
    startFrame: SLOGAN_START,
    durationInFrames: 55,
    cursor: { color: "#FFC23C" },
    fade: true,
  },
});
main.add(slogan);

comp.add(main);

main.register((frame) => {
  // 1. The dot pops in at 200% and blinks a few times.
  const pop = interpolate(frame, [0, POP_END], [0, 1], {
    easing: Easing.out(Easing.back(2)),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  dot.scaleX(pop);
  dot.scaleY(pop);
  dot.opacity(
    interpolate(frame, [...BLINK], [1, 0.1, 1, 0.1, 1, 0.1, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  // 2. It glides left, then 3. sweeps right; each bar is pulled in as the dot
  // passes over it (reveal progress is a function of the dot's x).
  const dotUnitX =
    frame < GLIDE[1]
      ? interpolate(frame, [...GLIDE], [DOT_HOME, DOT_LEFT], {
          easing: Easing.inOut(Easing.cubic),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(frame, [...SWEEP], [DOT_LEFT, DOT_HOME], {
          easing: Easing.inOut(Easing.sin),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  dot.x(dotUnitX * S);

  for (const bar of bars) {
    // Gate on the sweep so the leftward glide doesn't trigger reveals.
    const raw =
      frame < SWEEP[0]
        ? 0
        : interpolate(dotUnitX, [bar.unitX - 2, bar.unitX + 9], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
    const pull = Easing.out(Easing.back(1.8))(raw);
    bar.node.opacity(Math.min(1, raw * 3));
    bar.node.points([bar.X, MID - bar.half * pull, bar.X, MID + bar.half * pull]);
    bar.node.x((1 - pull) * 5 * S); // drifts in toward the dot as it reveals
  }

  // 4 + 5. The finished 200% logo slides left and settles at 100%,
  const settle = interpolate(frame, [...LOCKUP], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  logo.x(width / 2 + (MARK_FINAL_X - width / 2) * settle);
  logo.scaleX(2 - settle);
  logo.scaleY(2 - settle);

  // 6. ...making room for the wordmark: a clip opens left -> right while the
  // text drifts slightly right into place.
  const reveal = interpolate(frame, [...WORD], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  wordmarkClip.clipWidth(reveal * 480);
  wordmark.x(reveal * 20); // small drift right, never left of the clip edge
});

export default comp;
