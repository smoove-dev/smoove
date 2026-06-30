import { Block, Composition, Rect, Sequence, Text, interpolateColors } from "@smoove/core";

/**
 * A card built with Block: a Flex container that paints a gradient background,
 * a border, rounded corners, and a shadow behind its children. The card is a
 * direct child of the Sequence, so it lays out and restyles every tick. For a
 * liquid-glass feel the colored glow orbits the card (offsetX/offsetY trace a
 * circle), its hue cycles, and the surface gradient rotates so the sheen sweeps
 * around with it.
 */
const width = 1280;
const height = 720;
const duration = 240;

const comp = new Composition({
  id: "block-card",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

// Background first.
const bg = new Sequence({ from: 0, durationInFrames: duration });
bg.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
comp.add(bg);

const content = new Sequence({ from: 0, durationInFrames: duration });

const cardWidth = 620;
const card = new Block({
  x: (width - cardWidth) / 2,
  y: 190,
  width: cardWidth,
  flexDirection: "column",
  padding: 32,
  gap: 16,
  background: {
    gradient: {
      type: "linear",
      angle: 135,
      stops: [
        [0, "#1f2937"],
        [1, "#0b1120"],
      ],
    },
  },
  borderSize: 1,
  borderColor: "#374151",
  cornerRadius: 18,
  // A colored glow so the animated shadow reads against the dark background.
  // The updater orbits its offset and cycles its hue for the liquid-glass feel.
  shadow: { color: "#4ea1ff", blur: 38, offsetX: 26, offsetY: 0, opacity: 0.6 },
});

card.add(
  new Text({
    text: "Block is a Flex that paints itself",
    fontSize: 30,
    fontStyle: "bold",
    fill: "#f9fafb",
  }),
);
card.add(
  new Text({
    text: "Set a background, a border, a corner radius, and a shadow. Drop children in; they lay out with the same flex props as Flex and render on top of the styled rect.",
    fontSize: 17,
    lineHeight: 1.5,
    fill: "#cbd5e1",
  }),
);

// A row of swatches inside the card, each its own little Block.
const swatchRow = new Block({
  width: "100%",
  flexDirection: "row",
  gap: 12,
  background: "transparent",
});
for (const fill of ["#4ea1ff", "#b5179e", "#80ffdb", "#f0c000"]) {
  swatchRow.add(new Rect({ width: 120, height: 44, cornerRadius: 10, fill }));
}
card.add(swatchRow);

content.add(card);

// A looping palette for the glow; the last stop repeats the first so the cycle
// wraps seamlessly when the timeline loops.
const glowPalette = ["#4ea1ff", "#7c5cff", "#22d3ee", "#4ea1ff"];

content.register((frame) => {
  const t = frame / duration; // 0 -> 1 over the loop
  const angle = t * Math.PI * 2;
  const orbit = 30; // px radius the glow traces around the card

  card.setAttrs({
    shadow: {
      color: interpolateColors(t, [0, 1 / 3, 2 / 3, 1], glowPalette),
      blur: 34 + 12 * Math.sin(angle * 2), // breathe a little while it travels
      offsetX: Math.cos(angle) * orbit,
      offsetY: Math.sin(angle) * orbit,
      opacity: 0.6,
    },
    // Rotate the surface gradient so the sheen sweeps with the glow.
    background: {
      gradient: {
        type: "linear",
        angle: t * 360,
        stops: [
          [0, "#2b3a52"],
          [1, "#0b1120"],
        ],
      },
    },
  });
});

comp.add(content);
export default comp;
