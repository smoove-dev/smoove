import { Composition, Easing, Sequence, interpolate } from "@konva-motion/core";
import Konva from "konva";
import type { DemoDef } from "./types.js";

const SEEDS = ["paris", "tokyo", "lagos", "patagonia"];

const loadImage = (url: string): HTMLImageElement => {
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  return img;
};

export const imageFadeDemo: DemoDef = {
  id: "image-fade",
  name: "Image — crossfade",
  build() {
    const width = 1280;
    const height = 720;
    const perSlide = 90;
    const total = SEEDS.length * perSlide;
    const comp = new Composition({
      id: "image-fade",
      fps: 30,
      durationInFrames: total,
      width,
      height,
      loop: true,
    });

    const main = new Sequence({ from: 0, durationInFrames: total });
    main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

    const nodes: Konva.Image[] = SEEDS.map((seed, i) => {
      const node = new Konva.Image({
        image: undefined,
        x: 0,
        y: 0,
        width,
        height,
        opacity: i === 0 ? 1 : 0,
      });
      main.add(node);
      const htmlImg = loadImage(
        `https://picsum.photos/seed/${seed}/${Math.round(width)}/${Math.round(height)}`,
      );
      htmlImg.onload = () => node.image(htmlImg);
      return node;
    });

    main.register((frame) => {
      const fade = 30; // crossfade duration in frames
      for (let i = 0; i < nodes.length; i++) {
        const start = i * perSlide;
        const end = start + perSlide;
        // Fade in over [start, start+fade]; fade out over [end-fade, end].
        let opacity: number;
        if (frame < start - fade || frame > end) {
          opacity = 0;
        } else if (frame < start) {
          opacity = interpolate(frame, [start - fade, start], [0, 1], {
            easing: Easing.inOut(Easing.sin),
          });
        } else if (frame > end - fade) {
          opacity = interpolate(frame, [end - fade, end], [1, 0], {
            easing: Easing.inOut(Easing.sin),
          });
        } else {
          opacity = 1;
        }

        // Subtle Ken-Burns zoom while visible.
        const t = (frame - start) / perSlide;
        const scale = interpolate(Math.max(0, Math.min(1, t)), [0, 1], [1, 1.08]);
        const node = nodes[i] as Konva.Image;
        node.opacity(opacity);
        node.scale({ x: scale, y: scale });
        node.offset({ x: width / 2, y: height / 2 });
        node.position({ x: width / 2, y: height / 2 });
      }
    });

    comp.add(main);
    return comp;
  },
};
