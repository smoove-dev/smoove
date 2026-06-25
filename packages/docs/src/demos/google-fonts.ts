import { Composition, Sequence, Text, interpolate } from "@konva-motion/core";
import PlayfairDisplay from "@konva-motion/google-fonts/playfair-display";

/**
 * The google-fonts demo. One typed import per family
 * (`@konva-motion/google-fonts/playfair-display`) gives a `Font` subclass; we
 * register two weights and an italic, then pick faces with `.face(...)`. No font
 * files to host: the package points at Google's woff2 URLs, and the composition
 * buffers on them like any other `Font`.
 */
const width = 1280;
const height = 720;
const duration = 150;

const comp = new Composition({
  id: "google-fonts",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const scene = new Sequence({ from: 0, durationInFrames: duration });

const playfair = new PlayfairDisplay({
  weights: ["400", "700"],
  styles: ["normal", "italic"],
});
scene.add(playfair);

const lines: Array<{ text: string; selector: string; size: number; fill: string }> = [
  { text: "Playfair Display", selector: "700", size: 88, fill: "#f9fafb" },
  { text: "from @konva-motion/google-fonts", selector: "400", size: 40, fill: "#9ca3af" },
  { text: "one import per family", selector: "400-italic", size: 40, fill: "#a5b4fc" },
];

const nodes = lines.map((line, i) => {
  const node = new Text({
    x: 0,
    y: 180 + i * 110,
    width,
    align: "center",
    text: line.text,
    font: playfair.face(line.selector),
    fontSize: line.size,
    fill: line.fill,
  });
  scene.add(node);
  return node;
});

scene.register((frame) => {
  nodes.forEach((node, i) => {
    node.opacity(
      interpolate(frame, [i * 12, i * 12 + 24], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  });
});

comp.add(scene);
export default comp;
