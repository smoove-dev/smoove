import { Composition, Flex, Rect, Sequence, Text, interpolate } from "@konva-motion/core";

/**
 * One Flex row, reflowed straight from the frame. The updater never touches an
 * x or a y: it sets the container's `gap` and one child's `flexGrow` with
 * setAttrs, and the engine recomputes the layout each tick. Watch the chips
 * breathe apart as the gap grows, and the second chip stretch to eat whatever
 * space is left over.
 */
const width = 1280;
const height = 720;
const duration = 240;

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const comp = new Composition({
  id: "flex-reflow",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

// Background layer first so it sits under the row (layer order = add order).
const bg = new Sequence({ from: 0, durationInFrames: duration });
bg.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
bg.add(
  new Text({
    x: 0,
    y: 110,
    width,
    align: "center",
    text: "flex.setAttrs({ gap }) + chip.setAttrs({ flexGrow }), reflowed each tick",
    fontSize: 24,
    fontFamily: mono,
    fill: "#7d8590",
  }),
);
comp.add(bg);

// The row lives in its own Sequence; the Flex is a DIRECT child so the engine
// runs its layout every frame.
const content = new Sequence({ from: 0, durationInFrames: duration });

const rowWidth = 1000;
const row = new Flex({
  x: (width - rowWidth) / 2,
  y: 280,
  width: rowWidth,
  height: 180,
  flexDirection: "row",
  alignItems: "center",
  gap: 16,
  padding: 16,
});

const colors = ["#4ea1ff", "#b5179e", "#80ffdb", "#f0c000"];
const chips = colors.map(
  (fill) => new Rect({ width: 150, height: 150, cornerRadius: 18, fill }),
);
for (const chip of chips) row.add(chip);

content.add(row);

content.register((frame) => {
  const t = frame / (duration - 1);
  const wave = 0.5 - 0.5 * Math.cos(Math.PI * 2 * t); // 0 -> 1 -> 0, smooth
  row.setAttrs({ gap: interpolate(wave, [0, 1], [16, 90]) });
  // The second chip grows to fill the leftover space; the others stay fixed.
  chips[1]?.setAttrs({ flexGrow: interpolate(wave, [0, 1], [0, 2.5]) });
});

comp.add(content);
export default comp;
