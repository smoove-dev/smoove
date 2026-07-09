import { Composition, Easing, Flex, Image, interpolate, Sequence } from "@smoove/core";
import Konva from "konva";

const SEEDS = ["alps", "bay", "canyon", "dune"];

const width = 1280;
const height = 720;
const perSlot = 60;
const total = SEEDS.length * perSlot;
const comp = new Composition({
  id: "flex-row-grow",
  fps: 30,
  durationInFrames: total,
  width,
  height,
  loop: true,
});

const main = new Sequence({ from: 0, durationInFrames: total });
main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

const rowHeight = Math.min(280, height - 80);
const rowWidth = width - 40;
const row = new Flex({
  x: 20,
  y: (height - rowHeight) / 2,
  width: rowWidth,
  height: rowHeight,
  flexDirection: "row",
  gap: 10,
  alignItems: "stretch",
});

const images = SEEDS.map(
  (seed) =>
    new Image({
      src: `https://picsum.photos/seed/${seed}/600/600`,
      objectFit: "cover",
      cornerRadius: 12,
      flexGrow: 1,
    }),
);
for (const img of images) row.add(img);
main.add(row);

main.register((frame) => {
  const active = Math.floor(frame / perSlot) % SEEDS.length;
  const localT = (frame % perSlot) / perSlot;
  const eased = interpolate(localT, [0, 0.5, 1], [1, 4, 1], {
    easing: Easing.inOut(Easing.cubic),
  });
  for (let i = 0; i < images.length; i++) {
    images[i]?.setAttr("flexGrow", i === active ? eased : 1);
  }
});

comp.add(main);
export default comp;
