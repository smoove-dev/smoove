import { Block, Composition, Flex, Image, Sequence } from "@konva-motion/core";
import Konva from "konva";
import type { DemoDef } from "./types.js";

const MESSAGE =
  "Type as much as you want — the image below stays glued to the bottom of the text and slides down as new lines appear. No manual height math.";

export const flexTypewriterDemo: DemoDef = {
  id: "flex-typewriter",
  name: "Flex — typewriter pushes image",
  build(container, width, height) {
    const duration = 240;
    const comp = new Composition({
      id: "flex-typewriter",
      fps: 30,
      durationInFrames: duration,
      container,
      width,
      height,
      loop: true,
    });

    const main = new Sequence({ from: 0, durationInFrames: duration });
    main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

    const cardWidth = Math.min(440, width - 40);
    const card = new Flex({
      x: (width - cardWidth) / 2,
      y: 40,
      width: cardWidth,
      flexDirection: "column",
    });

    const body = new Block({
      width: "100%",
      flexDirection: "column",
      padding: 20,
      gap: 16,
      background: "#161b22",
      borderSize: 1,
      borderColor: "#30363d",
      cornerRadius: 14,
      shadow: { color: "#000", blur: 20, offsetY: 6, opacity: 0.5 },
    });

    const title = new Konva.Text({
      text: "",
      fontSize: 18,
      lineHeight: 1.4,
      fill: "#e6edf3",
    });

    const image = new Image({
      width: "100%",
      height: 180,
      src: "https://picsum.photos/seed/typewriter/800/360",
      objectFit: "cover",
      cornerRadius: 10,
    });

    body.add(title);
    body.add(image);
    card.add(body);
    main.add(card);

    const typeFrames = duration - 30;
    main.register((frame) => {
      const n = Math.min(MESSAGE.length, Math.floor((frame / typeFrames) * MESSAGE.length));
      title.text(MESSAGE.slice(0, n));
    });

    comp.add(main);
    return comp;
  },
};
