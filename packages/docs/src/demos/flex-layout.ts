import { Block, Composition, Easing, Flex, Image, Sequence, interpolate } from "@konva-motion/core";
import Konva from "konva";

const width = 1280;
const height = 720;
const duration = 360;
const comp = new Composition({
  id: "flex-layout",
  fps: 60,
  durationInFrames: duration,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: duration });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const cardMin = Math.min(320, width - 80);
const cardMax = Math.min(560, width - 40);

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
  src: "https://picsum.photos/seed/konva-motion/800/320",
  objectFit: "cover",
  cornerRadius: 10,
});

const heading = new Konva.Text({
  text: "Auto layout, no manual math",
  fontSize: 22,
  fontStyle: "bold",
  fill: "#f9fafb",
});

const body = new Konva.Text({
  text: "Drop blocks into a Flex. Text never overlaps the image. Flexily walks the tree each tick and re-flows whatever changed (width, gap, content).",
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
  // Animate the container's own layout width via the flexWidth attr. Calling
  // card.width(w) would set Konva's bounding box, which the layout never reads.
  card.setAttrs({ flexWidth: w });
  card.x((width - w) / 2);
  card.y(
    interpolate(t, [0, 1], [(height - 360) / 2, (height - 360) / 2], {
      easing: Easing.inOut(Easing.cubic),
    }),
  );
});

comp.add(main);
export default comp;
