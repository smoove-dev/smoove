import type { HighlightConfig } from "@smoove/core";
import { Block, Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import Konva from "konva";

const MUTED = "#7d8590";
const FONT = "ui-sans-serif, system-ui, sans-serif";

function label(text: string, x: number, y: number): Konva.Text {
  return new Konva.Text({ x, y, text, fontSize: 12, fontFamily: FONT, fill: MUTED });
}

/** Find a substring range as { start, end } char indices. */
function range(haystack: string, needle: string): { start: number; end: number } {
  const start = haystack.indexOf(needle);
  return { start, end: start + needle.length };
}

const fps = 30;
const duration = 150;

const width = 512;
const height = 512;

const comp = new Composition({
  id: "text-highlight",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: duration });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const M = 24;
const colW = width - M * 2;

// 1. A single animated highlight inside a Block.
main.add(label("highlight inside a Block (animated sweep)", M, 16));
const T1 = "Drop a highlighter behind any phrase, even inside a flex Block.";
const r1 = range(T1, "inside a flex Block");
const hl1: HighlightConfig = {
  ...r1,
  background: "#f0c000",
  color: "#0d1117",
  paddingStart: 4,
  paddingEnd: 4,
  cornerRadiusStart: 4,
  cornerRadiusEnd: 4,
  progress: 0,
};
const box1 = new Block({
  x: M,
  y: 34,
  width: Math.min(colW, 440),
  flexDirection: "column",
  padding: 16,
  background: "#161b22",
  borderSize: 1,
  borderColor: "#30363d",
  cornerRadius: 12,
});
box1.add(
  new Text({
    width: "100%",
    text: T1,
    highlights: [hl1],
    fontSize: 20,
    lineHeight: 1.5,
    fontFamily: FONT,
    fill: "#e6edf3",
  }),
);
main.add(box1);

// 2. Several marks at once, each a different corner radius.
const y2 = 150;
main.add(label("multiple highlights — different corner radii", M, y2));
const T2 = "A square tag, a pill shape, and an asymmetric one.";
const multi = new Text({
  x: M,
  y: y2 + 18,
  width: colW,
  text: T2,
  fontSize: 20,
  lineHeight: 1.8,
  fontFamily: FONT,
  fill: "#e6edf3",
  highlights: [
    {
      // square corners (0)
      ...range(T2, "square tag"),
      background: "#ff7b72",
      color: "#0d1117",
      cornerRadiusStart: 0,
      cornerRadiusEnd: 0,
      paddingStart: 4,
      paddingEnd: 4,
    },
    {
      // full pill (large radius is capped at half the mark height)
      ...range(T2, "pill shape"),
      background: "#388bfd",
      color: "#fff",
      cornerRadiusStart: 999,
      cornerRadiusEnd: 999,
      paddingStart: 8,
      paddingEnd: 8,
    },
    {
      // asymmetric — big radius on the start, small on the end
      ...range(T2, "asymmetric one"),
      background: "#3fb950",
      color: "#0d1117",
      cornerRadiusStart: 16,
      cornerRadiusEnd: 6,
      paddingStart: 6,
      paddingEnd: 6,
    },
  ],
});
main.add(multi);

// 3. A long, multi-line highlight next to a short one.
const y3 = 250;
main.add(label("long (spans wrapped lines) + short", M, y3));
const T3 =
  "A long highlight can span across several wrapped lines without rounding or padding the broken edge, while a short one marks just a word.";
const long = range(
  T3,
  "span across several wrapped lines without rounding or padding the broken edge",
);
const short = range(T3, "word");
const hlLong: HighlightConfig = {
  ...long,
  background: "rgba(240,192,0,0.35)",
  paddingStart: 3,
  paddingEnd: 3,
  cornerRadiusStart: 4,
  cornerRadiusEnd: 4,
  progress: 0,
};
const big = new Text({
  x: M,
  y: y3 + 18,
  width: colW,
  text: T3,
  fontSize: 19,
  lineHeight: 1.6,
  fontFamily: FONT,
  fill: "#e6edf3",
  highlights: [
    hlLong,
    {
      ...short,
      background: "#bc8cff",
      color: "#0d1117",
      cornerRadiusStart: 4,
      cornerRadiusEnd: 4,
      paddingStart: 3,
      paddingEnd: 3,
    },
  ],
});
main.add(big);

main.register((local) => {
  // box1 is a flex child (reflowed each frame) — just set progress.
  hl1.progress = interpolate(local, [10, 50], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // big is a direct child — set progress and re-render it.
  hlLong.progress = interpolate(local, [40, 110], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  big._layoutText();
});

comp.add(main);
export default comp;
