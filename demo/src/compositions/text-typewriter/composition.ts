import type { HighlightConfig } from "@smoove/core";
import { Block, Composition, Easing, interpolate, Sequence, Text } from "@smoove/core";
import Konva from "konva";

const MUTED = "#7d8590";
const FONT = "ui-sans-serif, system-ui, sans-serif";

function label(text: string, x: number, y: number): Konva.Text {
  return new Konva.Text({ x, y, text, fontSize: 12, fontFamily: FONT, fill: MUTED });
}

const fps = 30;
const duration = 200;

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

const main = new Sequence({ from: 0, durationInFrames: duration });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const M = 24;
const colW = width - M * 2;

// 1. Typewriter inside a Block bubble (the bubble reserves full height).
main.add(label("typewriter inside a Block (chat bubble)", M, 16));
const bubble = new Block({
  x: M,
  y: 34,
  width: Math.min(colW, 420),
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
    fontFamily: FONT,
    fill: "#fff",
  }),
);
main.add(bubble);

// 2. Type, then highlight the key phrase.
const y2 = 196;
main.add(label("typewriter, then highlight the key phrase", M, y2));
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
  y: y2 + 18,
  width: colW,
  text: PHRASE,
  typewriter: { mode: "letter", durationInFrames: 70 },
  highlights: [hl],
  fontSize: 20,
  lineHeight: 1.5,
  fontFamily: FONT,
  fill: "#e6edf3",
});
main.add(typeThenHl);

// 3. reserveHeight: true vs false — the caption below is pinned vs pushed.
const y3 = 320;
main.add(label("reserveHeight: true (caption stays put)", M, y3));
main.add(label("reserveHeight: false (caption is pushed down)", M + colW / 2 + 8, y3));
const halfW = colW / 2 - 8;
const PARA = "This text reveals line by line. Watch the caption beneath it as more lines appear.";

const makeColumn = (x: number, reserve: boolean) => {
  const col = new Block({
    x,
    y: y3 + 18,
    width: halfW,
    flexDirection: "column",
    gap: 8,
    padding: 12,
    background: "#161b22",
    borderSize: 1,
    borderColor: "#30363d",
    cornerRadius: 10,
  });
  col.add(
    new Text({
      width: "100%",
      text: PARA,
      typewriter: { mode: "letter", durationInFrames: 110, reserveHeight: reserve },
      fontSize: 14,
      lineHeight: 1.4,
      fontFamily: FONT,
      fill: reserve ? "#3fb950" : "#ff7b72",
    }),
  );
  // Caption pinned directly under the text in the column flow.
  const caption = new Block({
    width: "100%",
    padding: 6,
    background: reserve ? "#13351f" : "#3d1d1b",
    cornerRadius: 6,
  });
  caption.add(
    new Konva.Text({
      text: "↑ caption below the text",
      fontSize: 11,
      fontFamily: FONT,
      fill: MUTED,
    }),
  );
  col.add(caption);
  return col;
};
main.add(makeColumn(M, true));
main.add(makeColumn(M + colW / 2 + 8, false));

main.register((local) => {
  // Sweep the panel-2 highlight in once typing (70 frames) has finished.
  hl.progress = interpolate(local, [78, 108], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
});

comp.add(main);
export default comp;
