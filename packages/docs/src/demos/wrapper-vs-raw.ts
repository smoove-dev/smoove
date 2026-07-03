import { Composition, Flex, Rect, Sequence, Text } from "@smoove/core";
import Konva from "konva";

/**
 * Why prefer the core wrappers over raw `Konva.*`. Both rows are a Flex whose
 * width animates, and both hold a fixed box plus a "content" box that should
 * fill the rest of the row. The core `Rect` takes `flexGrow: 1`, so it stretches
 * to fill the row as it widens. The raw `Konva.Rect` is still measured and
 * placed by the layout engine, but it can't express `flexGrow`, so it stays its
 * fixed size and leaves a growing gap.
 */
const width = 1280;
const height = 720;
const duration = 300;
const minW = 360;
const maxW = 1040;
const rowX = 120;
const rowH = 150;
const FIXED = "#39c6c0";
const FILL = "#f0c000";

const comp = new Composition({
  id: "wrapper-vs-raw",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const label = (text: string, y: number, fill: string) =>
  new Text({
    x: rowX,
    y,
    text,
    fontSize: 26,
    fontStyle: "600",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fill,
  });

// An outline per row shows the animated container bounds, so "fills the row"
// vs "leaves a gap" is obvious. These are leaves, not laid out by the Flex.
const coreOutline = new Rect({
  x: rowX,
  y: 170,
  width: minW,
  height: rowH,
  stroke: "#30363d",
  strokeWidth: 2,
  cornerRadius: 12,
});
const rawOutline = new Rect({
  x: rowX,
  y: 470,
  width: minW,
  height: rowH,
  stroke: "#30363d",
  strokeWidth: 2,
  cornerRadius: 12,
});

// Row 1, core Rect with flexGrow: stretches to fill the row.
main.add(label("core Rect (flexGrow): fills the row ✓", 130, "#3fb950"));
main.add(coreOutline);
const coreRow = new Flex({
  x: rowX,
  y: 170,
  width: minW,
  height: rowH,
  flexDirection: "row",
  gap: 16,
  padding: 16,
  alignItems: "center",
});
coreRow.add(new Rect({ width: 110, height: 110, fill: FIXED, cornerRadius: 12 }));
coreRow.add(new Rect({ width: 50, height: 110, flexGrow: 1, fill: FILL, cornerRadius: 12 }));
main.add(coreRow);

// Row 2, raw Konva.Rect: laid out and placed, but no flexGrow, so it stays put.
main.add(label("raw Konva.Rect: can't grow, leaves a gap ✗", 430, "#f85149"));
main.add(rawOutline);
const rawRow = new Flex({
  x: rowX,
  y: 470,
  width: minW,
  height: rowH,
  flexDirection: "row",
  gap: 16,
  padding: 16,
  alignItems: "center",
});
rawRow.add(new Rect({ width: 110, height: 110, fill: FIXED, cornerRadius: 12 }));
rawRow.add(
  new Konva.Rect({ width: 110, height: 110, fill: FILL, cornerRadius: 12, opacity: 0.85 }),
);
main.add(rawRow);

main.register((frame) => {
  const t = frame / duration;
  const w = minW + (maxW - minW) * (0.5 - 0.5 * Math.cos(t * Math.PI * 2));
  coreOutline.width(w);
  rawOutline.width(w);
  // The Sequence recomputes each Flex root after this updater runs.
  coreRow.setAttrs({ flexWidth: w });
  rawRow.setAttrs({ flexWidth: w });
});

comp.add(main);
export default comp;
