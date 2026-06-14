import { Composition, Sequence } from "@konva-motion/core";
import Konva from "konva";

const width = 1280;
const height = 720;
const totalFrames = 180;
const comp = new Composition({
  id: "staggered",
  fps: 30,
  durationInFrames: totalFrames,
  loop: true,
  width,
  height,
});

const bg = new Sequence({ from: 0, durationInFrames: totalFrames });
bg.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
comp.add(bg);

const palette = ["#ff6b6b", "#ffd166", "#06d6a0", "#4ea1ff", "#c792ea"];
const count = palette.length;
const slotW = (width - 80) / count;
const fadeDuration = 30;
const holdEnd = totalFrames;

palette.forEach((color, i) => {
  const seq = new Sequence({
    from: i * 20,
    durationInFrames: holdEnd - i * 20,
  });
  const card = new Konva.Rect({
    x: 40 + i * slotW + slotW / 2 - 50,
    y: height / 2 - 60,
    width: 100,
    height: 120,
    fill: color,
    cornerRadius: 12,
    shadowColor: "black",
    shadowBlur: 20,
    shadowOpacity: 0.4,
  });
  seq.add(card);
  seq.register((local) => {
    const fade = Math.min(1, local / fadeDuration);
    const eased = fade * fade * (3 - 2 * fade);
    card.opacity(eased);
    card.y(height / 2 - 60 + (1 - eased) * 40);
  });
  comp.add(seq);
});

export default comp;
