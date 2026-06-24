import { Block, Composition, Font, Sequence, Text } from "@konva-motion/core";
import Konva from "konva";
import loraItalic from "../../files/fonts/lora-400-italic.woff2?url";
import loraRegular from "../../files/fonts/lora-400-normal.woff2?url";
import loraBold from "../../files/fonts/lora-700-normal.woff2?url";

const fps = 30;
const duration = 150;
const width = 512;
const height = 512;

const comp = new Composition({
  id: "custom-font",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

// A declarative font family. Registered at the Composition (via `seq.add`) so it
// loads — and the comp buffers on it — before playback. `?url` imports resolve to
// the font files; remote URLs work too (the browser fetches them directly).
const lora = new Font({
  family: "Lora",
  faces: [
    { weight: 400, style: "normal", src: loraRegular },
    { weight: 400, style: "italic", src: loraItalic },
    { weight: 700, style: "normal", src: loraBold },
  ],
});

const main = new Sequence({ from: 0, durationInFrames: duration });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
main.add(lora);

const col = new Block({
  x: 32,
  y: 32,
  width: width - 64,
  flexDirection: "column",
  gap: 18,
  padding: 28,
  background: "#161b22",
  borderSize: 1,
  borderColor: "#30363d",
  cornerRadius: 14,
});

// Bare Font → preferred face (400 / normal).
col.add(
  new Text({ width: "100%", font: lora, text: "Lora — regular", fontSize: 34, fill: "#e6edf3" }),
);
// font.face('700') → the bold face.
col.add(
  new Text({
    width: "100%",
    font: lora.face("700"),
    text: "Lora — bold (700)",
    fontSize: 30,
    fill: "#58a6ff",
  }),
);
// font.face('400-italic') → the italic face (throws if it didn't exist).
col.add(
  new Text({
    width: "100%",
    font: lora.face("400-italic"),
    text: "Lora — italic, loaded before play",
    fontSize: 24,
    fill: "#3fb950",
  }),
);
col.add(
  new Text({
    width: "100%",
    font: lora,
    text: "The composition buffers this font before the playhead advances, so there is no fallback-glyph flash.",
    fontSize: 18,
    lineHeight: 1.5,
    fill: "#7d8590",
  }),
);

main.add(col);
comp.add(main);
export default comp;
