/**
 * Scene 5 — how smoove works.
 *
 * Built on `@smoove/code`, so the snippet is really parsed (Lezer) and really
 * highlighted, and the change from one snapshot to the next is a per-token
 * diff: the lines that stay put stay put, and only the added block animates in.
 *
 * The point of the scene is the *pair*. First a static `Rect` — and a static
 * square below it. Then the props are edited and the square follows; then a
 * `register` block is added that drives the square with two `interpolate`
 * calls, and each of those lines carries a live comment showing the value
 * `interpolate` returns this frame — the same value being written to the box.
 */

import { parser } from "@lezer/javascript";
import { Code, interpolateCode, LezerHighlighter, makeHighlightStyle } from "@smoove/code";
import {
  Block,
  Circle,
  Easing,
  interpolate,
  interpolateColors,
  Rect,
  type Sequence,
  Text,
} from "@smoove/core";
import { videoPlate } from "../components/video-plate.js";
import {
  AMBER,
  BORDER,
  CORAL,
  HEIGHT,
  INK,
  MUTED,
  TEAL,
  TEXT,
  VIDEO,
  WIDTH,
} from "../constants.js";
import { comfortaa, mono } from "../fonts.js";

/**
 * Scene-local frame of VO3. Placed near the end: the viewer watches the code
 * build and the square move first, and the voice-over lands over the running
 * result. VO3 is ~93 frames and the scene is 285, so 160 ends it at ~253 —
 * clear of the 15-frame slide into the mixer scene.
 */
export const VO_AT = 160;
/**
 * Two diffs, not one. The first edits the `Rect`'s own props — size, fill,
 * corner radius — and the square below changes with them, which establishes
 * that the square *is* the code before anything starts moving. The second adds
 * the `register` block, and only then does it animate.
 */
const EDIT_AT = 46;
const EDIT_FOR = 30;
const ADD_AT = 104;
const ADD_FOR = 44;
/** The square starts moving the frame the code that moves it finishes landing. */
const RUN_AT = ADD_AT + ADD_FOR;

const PANEL_X = 70;
const PANEL_W = WIDTH - PANEL_X * 2;
const PANEL_Y = 216;
const PANEL_H = 492;

const STAGE_Y = 738;
const STAGE_H = 250;
/**
 * Must match the `width`/`height` in the snapshots — the whole point of the
 * scene is that the square is what the code says. The final 140 is bounded by
 * the stage: the rotated diagonal (140 * √2 ≈ 198) has to fit inside STAGE_H.
 */
const BOX_FROM = 110;
const BOX_TO = 140;
const RADIUS_FROM = 12;
const RADIUS_TO = 28;

/**
 * The animation's `interpolate` domain and ranges — shared by the shown code
 * and the box. Spanning most of the run (RUN_AT 148 → scene 285) keeps the
 * square moving through the extended tail rather than settling early.
 */
const RUN_SPAN = 110;
const ROT_RANGE = [0, 360] as const;
const RAD_RANGE = [RADIUS_TO, 70] as const; // 70 = half of 140, i.e. a full circle

const SNAP_A = `const box = new Rect({
  width: 110,
  height: 110,
  fill: "#15CDA8",
  cornerRadius: 12,
});`;

/** Same node, edited props. The square follows every one of them. */
const SNAP_B = `const box = new Rect({
  width: 140,
  height: 140,
  fill: "#FF5640",
  cornerRadius: 28,
});`;

/**
 * The animated block, with a live output comment on each line — the value
 * `interpolate` actually returns for `f` this frame. It is generated per frame
 * so those comments update as the square moves; `interpolate` (not `Math`) is
 * what the shown code uses, and it is literally what drives the box below.
 */
function animatedSnippet(rot: number, rad: number): string {
  // Pad the two calls to a common column so the `//` comments line up.
  const l1 =
    `  box.rotation(interpolate(f, [0, ${RUN_SPAN}], [${ROT_RANGE[0]}, ${ROT_RANGE[1]}]));`.padEnd(
      55,
    );
  const l2 =
    `  box.cornerRadius(interpolate(f, [0, ${RUN_SPAN}], [${RAD_RANGE[0]}, ${RAD_RANGE[1]}]));`.padEnd(
      55,
    );
  return `const box = new Rect({
  width: 140,
  height: 140,
  fill: "#FF5640",
  cornerRadius: 28,
});

seq.register((f) => {
${l1}// -> ${rot}°
${l2}// -> ${rad}
});`;
}

/** The block at f = 0 — the diff target, and where the live updates take over. */
const SNAP_C = animatedSnippet(ROT_RANGE[0], RAD_RANGE[0]);

/** The brand palette, expanded into a full CodeMirror highlight style. */
const theme = makeHighlightStyle({
  keyword: CORAL,
  name: TEXT,
  variable: TEXT,
  func: "#d2a8ff",
  string: AMBER,
  number: "#79c0ff",
  comment: "#6e7681",
  type: TEAL,
  operator: "#7d8590",
  punctuation: "#7d8590",
  constant: "#79c0ff",
  regexp: AMBER,
});
const highlighter = new LezerHighlighter(parser, theme);

export function code(seq: Sequence) {
  // An opaque base first — a scene that never reaches alpha 1 composites
  // against whatever is behind it.
  seq.add(new Rect({ x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: INK, listening: false }));
  seq.add(videoPlate({ src: VIDEO.bgCode, zoom: [1.1, 1.22], driftY: 0.4, opacity: 0.5 }));
  seq.add(
    new Rect({
      x: 0,
      y: 0,
      width: WIDTH,
      height: HEIGHT,
      fill: INK,
      opacity: 0.66,
      listening: false,
    }),
  );

  const kicker = new Text({
    x: PANEL_X,
    y: 124,
    text: "HOW SMOOVE WORKS",
    font: comfortaa.face("700"),
    fontSize: 30,
    fill: TEXT,
    letterSpacing: 4,
    wrap: "none",
    width: PANEL_W,
    listening: false,
  });
  const sub = new Text({
    x: PANEL_X,
    y: 168,
    text: "you describe the frame, smoove renders it",
    font: comfortaa.face("400"),
    fontSize: 26,
    fill: MUTED,
    wrap: "none",
    width: PANEL_W,
    listening: false,
  });
  seq.add(kicker, sub);

  // -- the editor ------------------------------------------------------------
  // Fixed height, sized for the longer snapshot, so the panel does not resize
  // under the code and collide with the stage below.
  const panel = new Block({
    x: PANEL_X,
    y: PANEL_Y,
    width: PANEL_W,
    height: PANEL_H,
    cornerRadius: 18,
    background: {
      gradient: {
        type: "linear",
        stops: [
          [0, "#11161ff2"],
          [1, "#0b0f15f2"],
        ],
        angle: 120,
      },
    },
    borderSize: 1,
    borderColor: BORDER,
  });
  seq.add(panel);

  // Window chrome, placed rather than laid out — the Code node is not a flex
  // child, so the panel has nothing to lay out anyway.
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    seq.add(
      new Circle({
        x: PANEL_X + 34 + i * 24,
        y: PANEL_Y + 32,
        radius: 7,
        fill: c,
        opacity: 0.9,
        listening: false,
      }),
    );
  });
  seq.add(
    new Rect({
      x: PANEL_X + 22,
      y: PANEL_Y + 56,
      width: PANEL_W - 44,
      height: 1,
      fill: "#ffffff12",
      listening: false,
    }),
  );

  const codeNode = new Code({
    x: PANEL_X + 34,
    y: PANEL_Y + 78,
    content: SNAP_A,
    highlighter,
    font: mono.face("400"),
    // 21: the animated lines carry a trailing output comment and must fit
    // the panel width without wrapping.
    fontSize: 21,
    lineHeight: 1.5,
    fill: TEXT,
    listening: false,
  });
  seq.add(codeNode);

  // -- the result stage ------------------------------------------------------
  const stage = new Block({
    x: PANEL_X,
    y: STAGE_Y,
    width: PANEL_W,
    height: STAGE_H,
    cornerRadius: 18,
    background: {
      gradient: {
        type: "linear",
        stops: [
          [0, "#0f151ecc"],
          [1, "#0a0e14cc"],
        ],
        angle: 120,
      },
    },
    borderSize: 1,
    borderColor: BORDER,
  });
  seq.add(stage);

  // A drawn dot rather than a "▶" glyph — the mono face has no such character
  // and renders it as tofu.
  const runDot = new Circle({
    x: PANEL_X + 30,
    y: STAGE_Y + 28,
    radius: 6,
    fill: MUTED,
    listening: false,
  });
  const runLabel = new Text({
    x: PANEL_X + 46,
    y: STAGE_Y + 18,
    text: "static",
    font: mono.face("400"),
    fontSize: 18,
    fill: MUTED,
    wrap: "none",
    width: 220,
    listening: false,
  });
  seq.add(runDot, runLabel);

  // The square. Added straight to the sequence (not a flex child), and
  // origin-corrected so it spins about its own centre.
  const box = new Rect({
    x: WIDTH / 2,
    y: STAGE_Y + STAGE_H / 2,
    width: BOX_FROM,
    height: BOX_FROM,
    offsetX: BOX_FROM / 2,
    offsetY: BOX_FROM / 2,
    fill: TEAL,
    cornerRadius: RADIUS_FROM,
    listening: false,
  });
  seq.add(box);

  seq.register((frame) => {
    const intro = interpolate(frame, [0, 18], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    kicker.opacity(intro);
    sub.opacity(
      interpolate(frame, [6, 24], [0, 1], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
    panel.opacity(intro);
    codeNode.opacity(intro);

    // The square's own values this frame, from `interpolate` — the exact calls
    // shown in the block. Computed first so the live comments and the box read
    // from one source.
    const running = frame >= RUN_AT;
    const f = Math.max(0, frame - RUN_AT);
    const rot = interpolate(f, [0, RUN_SPAN], [ROT_RANGE[0], ROT_RANGE[1]], {
      extrapolateRight: "clamp",
    });
    const rad = interpolate(f, [0, RUN_SPAN], [RAD_RANGE[0], RAD_RANGE[1]], {
      extrapolateRight: "clamp",
    });

    // Two per-token diffs, then live content: props first, then the block types
    // in, then — once running — the block re-renders each frame with the
    // current output in its comments. Lines that do not change never move.
    codeNode.setContent(
      running
        ? animatedSnippet(Math.round(rot), Math.round(rad))
        : interpolateCode(
            frame,
            [EDIT_AT, EDIT_AT + EDIT_FOR, ADD_AT, ADD_AT + ADD_FOR],
            [SNAP_A, SNAP_B, SNAP_B, SNAP_C],
            {
              easing: Easing.inOut(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
    );

    // The square is edited to match the props on the same frames as the diff.
    const edit = interpolate(frame, [EDIT_AT, EDIT_AT + EDIT_FOR], [0, 1], {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const size = BOX_FROM + (BOX_TO - BOX_FROM) * edit;
    box.width(size);
    box.height(size);
    box.offsetX(size / 2);
    box.offsetY(size / 2);
    box.fill(interpolateColors(edit, [0, 1], [TEAL, CORAL]));

    const stageIn = interpolate(frame, [24, 44], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    stage.opacity(stageIn);
    box.opacity(stageIn);
    runDot.opacity(stageIn);
    runLabel.opacity(stageIn);

    // Once running, the two `interpolate` calls drive the box; before that it
    // holds at the edited props (radius eases 12 → 28, rotation flat at 0).
    if (running) {
      box.rotation(rot);
      box.cornerRadius(rad);
    } else {
      box.rotation(0);
      box.cornerRadius(RADIUS_FROM + (RADIUS_TO - RADIUS_FROM) * edit);
    }
    runDot.fill(running ? TEAL : MUTED);
    runLabel.setText(running ? "running" : "static");
    runLabel.setFill(running ? TEAL : MUTED);
  });
}

/** Local frames the typing sound should cover — both diffs, not the whole scene. */
export const TYPING = [EDIT_AT, ADD_AT + ADD_FOR] as const;
