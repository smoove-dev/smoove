import { Composition, Flex, Rect, Sequence, Text } from "@konva-motion/core";
import Konva from "konva";

/**
 * Why prefer the core wrappers over raw `Konva.*`. Both rows sit in a Flex whose
 * `gap` animates. The core `Rect`s implement the layout contract, so they reflow
 * as the gap grows. The raw `Konva.Rect`s are invisible to the layout engine —
 * they render, but stay frozen wherever you first put them.
 */
const width = 1280;
const height = 720;
const duration = 150;
const startGap = 24;
const maxGap = 210;
const itemW = 150;
const colors = ["#4cc9f0", "#b5179e", "#80ffdb"];

const comp = new Composition({
  id: "wrapper-vs-raw",
  fps: 30,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: duration });
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const label = (text: string, y: number, fill: string) =>
  new Text({
    x: 200,
    y,
    text,
    fontSize: 26,
    fontStyle: "600",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fill,
  });

// Row 1 — core Rect: participates in layout, reflows with the gap.
main.add(label("core Rect — reflows ✓", 130, "#3fb950"));
const coreRow = new Flex({ x: 200, y: 175, flexDirection: "row", gap: startGap });
for (const c of colors)
  coreRow.add(new Rect({ width: itemW, height: itemW, fill: c, cornerRadius: 14 }));
main.add(coreRow);

// Row 2 — raw Konva.Rect: renders, but the layout engine can't see it, so it
// stays put. We position each one by hand at the starting layout.
main.add(label("raw Konva.Rect — frozen ✗", 430, "#f85149"));
const rawRow = new Flex({ x: 200, y: 475, flexDirection: "row", gap: startGap });
colors.forEach((c, i) => {
  rawRow.add(
    new Konva.Rect({
      x: i * (itemW + startGap),
      y: 0,
      width: itemW,
      height: itemW,
      fill: c,
      cornerRadius: 14,
      opacity: 0.5,
    }),
  );
});
main.add(rawRow);

main.register((frame) => {
  const t = frame / duration;
  const gap = startGap + (maxGap - startGap) * (0.5 - 0.5 * Math.cos(t * Math.PI * 2));
  // Both rows get the same gap — only the core row actually reflows.
  coreRow.setAttrs({ gap });
  rawRow.setAttrs({ gap });
});

comp.add(main);
export default comp;
