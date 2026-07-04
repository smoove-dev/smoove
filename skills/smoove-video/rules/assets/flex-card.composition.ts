// Worked example for rules/layout.md — a gradient Block "card" (cover image +
// heading + body) whose ROOT Flex animates width/position directly. Note that
// only the root is animated by x()/y()/width() — its children (cover, heading,
// body) are positioned by the flex layout pass and are never animated that way.
import { Block, Composition, Flex, Image, Rect, Sequence, Text } from "@smoove/core";

const width = 1280;
const height = 720;
const fps = 30;
const duration = fps * 6;

const comp = new Composition({
  id: "flex-card",
  fps,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence();
main.add(new Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const cardMin = Math.min(320, width - 80);
const cardMax = Math.min(560, width - 40);

// The root Flex — added straight to `main`, so nothing else places it. Safe
// to drive its x()/y()/width() directly from register().
const card = new Flex({
  x: 0,
  y: 0,
  width: cardMin,
  flexDirection: "column",
  padding: 16,
  gap: 12,
});

const cardBlock = new Block({
  width: "100%",
  flexDirection: "column",
  padding: 18,
  gap: 14,
  background: {
    gradient: {
      type: "linear",
      stops: [
        [0, "#1f2937"],
        [1, "#111827"],
      ],
      angle: 135,
    },
  },
  borderSize: 1,
  borderColor: "#374151",
  cornerRadius: 14,
  shadow: { color: "#000", blur: 24, offsetY: 8, opacity: 0.45 },
});

const cover = new Image({
  width: "100%",
  height: 160,
  src: "https://picsum.photos/seed/smoove/800/320",
  objectFit: "cover",
  cornerRadius: 10,
});

const heading = new Text({
  text: "Auto layout, no manual math",
  fontSize: 22,
  fontStyle: "bold",
  fill: "#f9fafb",
});

const body = new Text({
  text: "Drop blocks into a Flex. Text never overlaps the image — Flexily walks the tree each tick and re-flows whatever changed (width, gap, content).",
  fontSize: 14,
  lineHeight: 1.4,
  fill: "#d1d5db",
});

cardBlock.add(cover);
cardBlock.add(heading);
cardBlock.add(body);
card.add(cardBlock);

main.add(card);

main.register((frame) => {
  const t = frame / (duration - 1);
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * 2 * t);
  const w = cardMin + (cardMax - cardMin) * eased;
  // ✅ root Flex — its own x()/y()/width() are not overwritten by any parent layout pass.
  card.width(w);
  card.x((width - w) / 2);
  card.y((height - 360) / 2);
});

comp.add(main);
export default comp;
