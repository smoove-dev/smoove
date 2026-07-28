/**
 * Scene 3 — auto layout.
 *
 * One card definition, three beats: it renders, the content is swapped for
 * something a very different size, then two more components arrive. Nothing is
 * hand-positioned and nothing is re-created.
 *
 * The beats are *animated through the layout*, not toggled: each frame we set
 * `flexHeight` (and opacity) on the children, and the flex pass recomputes the
 * row, the column and the card from those — so the card's height eases from one
 * beat to the next instead of snapping. That easing is the demo. It has to be
 * `flexHeight` and not `height()`: the layout pass writes `width`/`height` back
 * onto every child after the updaters run, so animating those directly would be
 * overwritten. `opacity` is never touched by layout and is always safe.
 *
 * Both shots and both extra rows are present the whole time at height 0, so the
 * card's gaps never appear or disappear — nothing in the scene jumps.
 */
import { Block, Easing, Flex, Image, interpolate, Rect, type Sequence, Text } from "@smoove/core";
import { backdrop } from "../components/backdrop.js";
import {
  AMBER,
  BORDER,
  CARD,
  CARD_LEFT,
  CORAL,
  HANDOFF_IMAGE_H,
  MUTED,
  SHOTS,
  TEAL,
  TEXT,
} from "../constants.js";
import { comfortaa, mono } from "../fonts.js";

// -- beats -------------------------------------------------------------------

const CARD_IN = 12;
const BEAT_2 = 34;
const BEAT_3 = 72;
/**
 * How long each beat takes to ease into place. Short on purpose: the scene is
 * 148 frames and every beat has to have settled by ~100, because that is where
 * the video scene starts opening over the top of the card.
 */
const MORPH = 16;

const BEATS = [
  { at: 0, label: "ONE LAYOUT DEFINITION", note: 'flexDirection: "row"' },
  { at: BEAT_2, label: "ANY CONTENT SIZE", note: "// image 2.3:1 → 0.56:1" },
  { at: BEAT_3, label: "ADD COMPONENTS", note: "// two children, height 0 → auto" },
];

const SHORT_BODY = "A boy, a valley, and the long way down.";
const LONG_BODY =
  "A boy, a valley, and the long way down. The shot holds on the ridge line until the wind picks up, then follows him over the edge and into the green.";

const WIDE_H = Math.round(CARD.imageWidth / SHOTS.schoolyard.aspect);
const TALL_H = Math.round(HANDOFF_IMAGE_H);
const CHIPS_H = 42;
const THUMBS_H = 96;

// -- small parts -------------------------------------------------------------

/**
 * `width` is stated rather than hugged: a label sized to exactly its own ink
 * can be clipped by a sub-pixel rounding of its box, and `wrap: "none"` then
 * ellipsizes it. Fixed-width pills also keep the row rhythm even.
 */
function chip(text: string, color: string, width: number) {
  const block = new Block({
    padding: [7, 14],
    cornerRadius: 999,
    background: "#ffffff0f",
    borderSize: 1,
    borderColor: `${color}66`,
    alignSelf: "center",
  });
  block.add(
    new Text({
      text,
      font: mono.face("400"),
      fontSize: 19,
      fill: color,
      align: "center",
      wrap: "none",
      width,
    }),
  );
  return block;
}

/** Eased 0 → 1 ramp starting at `at`. */
const ramp = (frame: number, at: number, dur = MORPH) =>
  interpolate(frame, [at, at + dur], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export function layout(seq: Sequence) {
  seq.add(backdrop());

  // -- headings. Standalone (not flex children) so their y is ours to animate.
  const label = new Text({
    x: CARD_LEFT,
    y: 158,
    text: BEATS[0]!.label,
    font: comfortaa.face("700"),
    fontSize: 30,
    fill: TEXT,
    letterSpacing: 4,
    wrap: "none",
    width: CARD.width,
    listening: false,
  });
  const note = new Text({
    x: CARD_LEFT,
    y: 200,
    text: BEATS[0]!.note,
    font: mono.face("400"),
    fontSize: 21,
    fill: TEAL,
    wrap: "none",
    width: CARD.width,
    listening: false,
  });
  seq.add(label, note);

  // -- the layout-bounds overlay, tracking the card's measured box.
  const bounds = new Rect({
    x: CARD_LEFT - 10,
    y: CARD.top - 10,
    width: CARD.width + 20,
    height: 0,
    stroke: `${AMBER}88`,
    strokeWidth: 2,
    dash: [10, 8],
    cornerRadius: CARD.cornerRadius + 8,
    listening: false,
  });
  seq.add(bounds);

  // -- the card. Added straight to the sequence, so its x/y are fixed and its
  //    height is free to hug whatever the content needs. Scene 4's mask origin
  //    is derived from this same geometry.
  const card = new Block({
    x: CARD_LEFT,
    y: CARD.top,
    width: CARD.width,
    flexDirection: "column",
    gap: 20,
    padding: CARD.padding,
    cornerRadius: CARD.cornerRadius,
    background: {
      gradient: {
        type: "linear",
        stops: [
          [0, "#1b2432"],
          [1, "#121821"],
        ],
        angle: 135,
      },
    },
    borderSize: 1,
    borderColor: BORDER,
  });
  seq.add(card);

  const row = new Flex({
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 24,
  });
  card.add(row);

  // Both shots stacked in a zero-gap column, exactly one of them ever tall.
  // Their intrinsic aspects are wildly different (2.34 vs 0.56), so easing one
  // slot's height down while the other's comes up morphs the whole card.
  const slot = new Flex({ width: CARD.imageWidth, flexDirection: "column", gap: 0 });
  const imgWide = new Image({
    src: SHOTS.schoolyard.src,
    width: CARD.imageWidth,
    height: WIDE_H,
    objectFit: "cover",
    cornerRadius: 14,
  });
  const imgTall = new Image({
    src: SHOTS.street.src,
    width: CARD.imageWidth,
    height: 0,
    objectFit: "cover",
    cornerRadius: 14,
    opacity: 0,
  });
  slot.add(imgWide, imgTall);
  row.add(slot);

  const col = new Flex({ flexDirection: "column", gap: 12, flexGrow: 1 });
  row.add(col);

  const title = new Text({
    width: "100%",
    text: "Shot 01 · Schoolyard",
    font: comfortaa.face("700"),
    fontSize: 34,
    fill: TEXT,
  });
  const body = new Text({
    width: "100%",
    text: SHORT_BODY,
    font: comfortaa.face("400"),
    fontSize: 23,
    lineHeight: 1.45,
    fill: MUTED,
  });
  col.add(title, body);

  // -- the two components beat 3 brings in. Present from frame 0 at height 0,
  //    so the card's gaps are constant and nothing ever jumps.
  const chips = new Flex({
    width: "100%",
    height: 0,
    flexDirection: "row",
    gap: 10,
    opacity: 0,
  });
  chips.add(chip("anime", TEAL, 66), chip("establishing", CORAL, 145), chip("day", AMBER, 44));
  col.add(chips);

  const thumbs = new Flex({
    width: "100%",
    height: 0,
    flexDirection: "row",
    gap: 12,
    opacity: 0,
  });
  for (const shot of [SHOTS.engawa, SHOTS.tatami, SHOTS.schoolyard]) {
    thumbs.add(
      new Image({ src: shot.src, width: 168, height: 96, objectFit: "cover", cornerRadius: 10 }),
    );
  }
  card.add(thumbs);

  // -- live readout of the card's own measured height.
  const readout = new Text({
    x: CARD_LEFT,
    y: 0,
    text: "",
    font: mono.face("400"),
    fontSize: 20,
    fill: AMBER,
    wrap: "none",
    width: CARD.width,
    listening: false,
  });
  seq.add(readout);

  seq.register((frame) => {
    const intro = interpolate(frame, [0, CARD_IN], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    card.opacity(intro);
    bounds.opacity(intro * 0.9);
    readout.opacity(intro);

    // Beat 2 — the image slot morphs from a 2.3:1 crop to a 0.56:1 one. Setting
    // the two children's `flexHeight` is the whole move; the row, the column and
    // the card all re-derive their own heights from it.
    const t2 = ramp(frame, BEAT_2);
    imgWide.setAttr("flexHeight", WIDE_H * (1 - t2));
    imgTall.setAttr("flexHeight", TALL_H * t2);
    // The incoming shot reaches full strength early, so it fills its slot as
    // that slot grows (cover-cropped, it reads as a band opening up) while the
    // outgoing one clears out fast. Fading it in late instead leaves a hole in
    // the middle of the morph; fading them symmetrically makes mud.
    imgWide.opacity(Math.max(0, 1 - t2 * 2.2));
    imgTall.opacity(Math.min(1, t2 * 2.4));

    // The copy swaps at the midpoint of that morph, behind a quick dip, so the
    // text reflow happens inside the movement rather than popping.
    const dip = Math.abs(t2 - 0.5) * 2;
    title.setText(t2 > 0.5 ? "Shot 02 · Backstreet" : "Shot 01 · Schoolyard");
    body.setText(t2 > 0.5 ? LONG_BODY : SHORT_BODY);
    title.opacity(intro * (0.25 + 0.75 * dip));
    body.opacity(intro * (0.25 + 0.75 * dip));

    // Beat 3 — two children ease open from height 0, staggered.
    const t3a = ramp(frame, BEAT_3, 14);
    const t3b = ramp(frame, BEAT_3 + 8, 14);
    chips.setAttr("flexHeight", CHIPS_H * t3a);
    chips.opacity(t3a);
    thumbs.setAttr("flexHeight", THUMBS_H * t3b);
    thumbs.opacity(t3b);

    const beat = frame >= BEAT_3 ? 2 : frame >= BEAT_2 ? 1 : 0;
    const active = BEATS[beat]!;
    label.setText(active.label);
    note.setText(active.note);

    // `measure()` lays the card out on demand and reports its real stage-space
    // box. `card.height()` is the node's own attr, which lags a beat behind a
    // reflow — the overlay has to report what the layout actually did.
    const h = card.measure().height;
    bounds.height(h + 20);
    readout.y(CARD.top + h + 22);
    readout.setText(`card height: ${Math.round(h)}px · computed, not authored`);
  });
}
