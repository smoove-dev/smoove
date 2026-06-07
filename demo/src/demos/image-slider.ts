import { Composition, Easing, Sequence, interpolate } from "@konva-motion/core";
import Konva from "konva";
import type { DemoDef } from "./types.js";

const SEEDS = ["mountain", "ocean", "forest", "desert"];

const loadImage = (url: string): HTMLImageElement => {
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  return img;
};

export const imageSliderDemo: DemoDef = {
  id: "image-slider",
  name: "Image — slider",
  build() {
    const width = 1280;
    const height = 720;
    const perSlide = 60;
    const total = SEEDS.length * perSlide;
    const comp = new Composition({
      id: "image-slider",
      fps: 30,
      durationInFrames: total,
      width,
      height,
      loop: true,
    });

    const main = new Sequence({ from: 0, durationInFrames: total });
    main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

    const nodes: Konva.Image[] = SEEDS.map((seed) => {
      const node = new Konva.Image({
        image: undefined,
        x: width,
        y: 0,
        width,
        height,
      });
      main.add(node);
      const htmlImg = loadImage(
        `https://picsum.photos/seed/${seed}/${Math.round(width)}/${Math.round(height)}`,
      );
      htmlImg.onload = () => node.image(htmlImg);
      return node;
    });

    const label = new Konva.Text({
      x: 0,
      y: height - 56,
      width,
      align: "center",
      text: "",
      fill: "#fff",
      fontSize: 24,
      fontStyle: "bold",
      shadowColor: "#000",
      shadowBlur: 12,
      shadowOpacity: 0.6,
    });
    main.add(label);

    main.register((frame) => {
      const index = Math.min(SEEDS.length - 1, Math.floor(frame / perSlide));
      const local = frame - index * perSlide;
      label.text(SEEDS[index] ?? "");

      // Each slide: enters from right (0..15), holds (15..45), exits to left (45..60).
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i] as Konva.Image;
        if (i < index) {
          node.x(-width);
        } else if (i > index) {
          node.x(width);
        } else {
          const x = interpolate(local, [0, 15, 45, perSlide], [width, 0, 0, -width], {
            easing: Easing.inOut(Easing.cubic),
          });
          node.x(x);
        }
      }
    });

    comp.add(main);
    return comp;
  },
};
