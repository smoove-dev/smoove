/**
 * Scene 7 — the outro.
 *
 * The full lockup rebuilds itself on the scene-2 backdrop, slogan and all, so
 * the closing card and the opening card read as the same brand. The call to
 * action rises under it once the slogan has typed.
 */
import { Easing, interpolate, type Sequence, Text } from "@smoove/core";
import { HEIGHT, MUTED, SLOGAN, TEAL, WIDTH } from "../constants.js";
import { comfortaa } from "../fonts.js";
import { backdrop } from "../components/backdrop.js";
import { logoLockup } from "../components/logo.js";

/** The slogan finishes typing around local 138; the CTA follows it in. */
const CTA_AT = 138;
const CTA_Y = HEIGHT / 2 + 210;

export function outro(seq: Sequence) {
  seq.add(backdrop());
  seq.add(
    logoLockup({ x: WIDTH / 2, y: HEIGHT / 2 - 70, scale: 1.35, slogan: SLOGAN }),
  );

  // One centred `Text` spanning the frame, with the URL recoloured by a
  // highlight range. Three separate labels in a row would each be boxed to
  // exactly their own ink, which is what ellipsizes them.
  const CTA = "go to smoove.dev to learn more";
  const url = CTA.indexOf("smoove.dev");
  const cta = new Text({
    x: 0,
    y: CTA_Y,
    width: WIDTH,
    text: CTA,
    font: comfortaa.face("400"),
    fontSize: 34,
    fill: MUTED,
    align: "center",
    wrap: "none",
    highlights: [
      { start: url, end: url + "smoove.dev".length, background: "#00000000", color: TEAL },
    ],
    opacity: 0,
    listening: false,
  });
  seq.add(cta);

  seq.register((frame) => {
    const p = interpolate(frame, [CTA_AT, CTA_AT + 26], [0, 1], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    cta.opacity(p);
    // `cta` is added straight to the sequence, so its own y is ours to move.
    cta.y(CTA_Y + 30 * (1 - p));
  });
}
