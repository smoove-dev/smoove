import { Block, Composition, Sequence, Text } from "@smoove/core";
import JetBrainsMono from "@smoove/google-fonts/jetbrains-mono";
import Pacifico from "@smoove/google-fonts/pacifico";
import PlayfairDisplay from "@smoove/google-fonts/playfair-display";
import Roboto from "@smoove/google-fonts/roboto";
import Konva from "konva";

const fps = 30;
const duration = 150;
const width = 512;
const height = 512;

const comp = new Composition({
  id: "google-font",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

// Four Google fonts pulled by subpath import — a serif, a sans, a monospace, and
// a script. `weights`/`styles` select a subset (typed per family); omit to take
// all. Each is registered via `seq.add`, loaded from the Google Fonts CDN, and
// buffered before play.
const playfair = new PlayfairDisplay({ weights: ["400", "700"], styles: ["normal", "italic"] });
const roboto = new Roboto({ weights: ["400", "700"] });
const mono = new JetBrainsMono({ weights: ["400"] });
const pacifico = new Pacifico();

const main = new Sequence({ from: 0, durationInFrames: duration });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
main.add(playfair, roboto, mono, pacifico);

const col = new Block({
  x: 32,
  y: 40,
  width: width - 64,
  flexDirection: "column",
  gap: 16,
  padding: 28,
  background: "#161b22",
  borderSize: 1,
  borderColor: "#30363d",
  cornerRadius: 14,
});

// Serif — bold, then italic (face selection).
col.add(
  new Text({
    width: "100%",
    font: playfair.face("700"),
    text: "Playfair Display",
    fontSize: 36,
    fill: "#e6edf3",
  }),
);
col.add(
  new Text({
    width: "100%",
    font: playfair.face("400-italic"),
    text: "an elegant serif, in italic",
    fontSize: 20,
    fill: "#8b949e",
  }),
);
// Sans.
col.add(
  new Text({
    width: "100%",
    font: roboto,
    text: "Roboto — a clean sans-serif",
    fontSize: 22,
    fill: "#58a6ff",
  }),
);
// Monospace.
col.add(
  new Text({
    width: "100%",
    font: mono,
    text: "const code = jetBrainsMono;",
    fontSize: 18,
    fill: "#3fb950",
  }),
);
// Script.
col.add(
  new Text({
    width: "100%",
    font: pacifico,
    text: "Pacifico, a handwriting script",
    fontSize: 30,
    fill: "#f0883e",
  }),
);
// Caption (Roboto) — explains the source.
col.add(
  new Text({
    width: "100%",
    font: roboto,
    text: "Four Google fonts, pulled by subpath import from @smoove/google-fonts and loaded from the CDN, buffered before play.",
    fontSize: 15,
    lineHeight: 1.5,
    fill: "#7d8590",
  }),
);

main.add(col);
comp.add(main);
export default comp;
