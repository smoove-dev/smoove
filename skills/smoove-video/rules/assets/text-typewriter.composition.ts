// Worked example for rules/text.md — a Text typewriter reveal inside a Block
// "chat bubble", followed by a highlight sweep once typing finishes. Both
// effects are declared on the Text config and animated by mutating plain
// objects (HighlightConfig) or just letting `typewriter` run on its own clock
// — no manual per-character bookkeeping.
import type { HighlightConfig } from "@smoove/core";
import { Block, Composition, Easing, interpolate, Rect, Sequence, Text } from "@smoove/core";

const fps = 30;
const duration = fps * 5;
const width = 512;
const height = 512;

const comp = new Composition({
  id: "text-typewriter",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const M = 24;

// 1. Typewriter inside a Block bubble (the bubble reserves full height).
const bubble = new Block({
  x: M,
  y: 40,
  width: width - M * 2,
  flexDirection: "column",
  padding: 16,
  background: "#1f6feb",
  cornerRadius: [14, 14, 14, 4],
});
bubble.add(
  new Text({
    width: "100%",
    text: "Hi! This message types itself out, word by word, inside a flex bubble that already reserves its final height.",
    typewriter: { mode: "word", durationInFrames: 90, cursor: { color: "#fff" } },
    fontSize: 17,
    lineHeight: 1.45,
    fill: "#fff",
  }),
);
main.add(bubble);

// 2. Type, then sweep a highlight across the key phrase.
const PHRASE = "When the typing finishes, we sweep a highlight across the important part.";
const hlStart = PHRASE.indexOf("the important part");
const hl: HighlightConfig = {
  start: hlStart,
  end: hlStart + "the important part".length,
  background: "#f0c000",
  color: "#0d1117",
  paddingStart: 4,
  paddingEnd: 4,
  cornerRadiusStart: 4,
  cornerRadiusEnd: 4,
  progress: 0,
};
const typeThenHl = new Text({
  x: M,
  y: 220,
  width: width - M * 2,
  text: PHRASE,
  typewriter: { mode: "letter", durationInFrames: 70 },
  highlights: [hl],
  fontSize: 20,
  lineHeight: 1.5,
  fill: "#e6edf3",
});
main.add(typeThenHl);

main.register((local) => {
  // Sweep the highlight in once typing (70 frames) has finished.
  hl.progress = interpolate(local, [78, 108], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
});

comp.add(main);
export default comp;
