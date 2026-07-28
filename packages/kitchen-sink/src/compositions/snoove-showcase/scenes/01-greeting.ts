/**
 * Scene 1 — the greeting.
 *
 * Live footage under two words that rise into frame. The crop favours the
 * right of the 16:9 frame (where the character stands) so the type has the
 * open valley on the left to sit against.
 */
import { Easing, interpolate, Rect, type Sequence, Text } from "@smoove/core";
import { videoPlate } from "../components/video-plate.js";
import { HEIGHT, TEXT, VIDEO, WIDTH } from "../constants.js";
import { comfortaa } from "../fonts.js";

const LINES = [
  // { text: "hi", y: 372, in: 6 },
  // { text: "there", y: 528, in: 14 },
];

export function greeting(seq: Sequence) {
  // The clip is a crane-out from the character's shoes to the whole valley, so
  // it already owns the move: we join it 5s in, on the vista, and add only a
  // whisper of push so the two camera motions don't fight each other.
  seq.add(
    videoPlate({
      src: VIDEO.bgGreeting,
      trimBefore: 150,
      zoom: [1.02, 1.07],
      objectPosition: "center",
    }),
  );

  // Scrim across the left two-thirds — the type needs a floor to hold contrast
  // against, and a full-frame darkening would flatten the footage.
  seq.add(
    new Rect({
      x: 0,
      y: 0,
      width: WIDTH,
      height: HEIGHT,
      listening: false,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: WIDTH, y: 0 },
      fillLinearGradientColorStops: [0, "#08090ccc", 0.42, "#08090c77", 0.75, "#08090c00"],
    }),
  );

  const nodes = LINES.map((line) => {
    const node = new Text({
      x: 96,
      y: line.y,
      text: line.text,
      font: comfortaa.face("700"),
      fontSize: 132,
      fill: TEXT,
      align: "left",
      wrap: "none",
      // Explicit and generous. A Text sized to its own ink can be clipped by a
      // sub-pixel rounding of that box, and `wrap: "none"` ellipsizes when it
      // is — so every single-line label in this piece states its own box.
      width: 880,
      opacity: 0,
      listening: false,
    });
    seq.add(node);
    return { node, ...line };
  });

  seq.register((frame) => {
    for (const { node, y, in: start } of nodes) {
      const p = interpolate(frame, [start, start + 22], [0, 1], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      node.opacity(p);
      node.y(y + 56 * (1 - p));
    }
  });
}
