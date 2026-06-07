import { Composition, Easing, Sequence, interpolate, interpolateColors } from "@konva-motion/core";
import Konva from "konva";
import type { DemoDef } from "./types.js";

const PALETTE = ["#ff6b6b", "#ffd166", "#06d6a0", "#118ab2", "#9b5de5", "#ff6b6b"];

export const colorsDemo: DemoDef = {
  id: "colors",
  name: "Colors — fill + stroke interpolation",
  build() {
    const width = 1280;
    const height = 720;
    const duration = 180;
    const comp = new Composition({
      id: "colors",
      fps: 30,
      durationInFrames: duration,
      width,
      height,
      loop: true,
    });

    const main = new Sequence({ from: 0, durationInFrames: duration });

    const bgKeyframes = Array.from({ length: PALETTE.length }, (_, i) =>
      Math.round((i * (duration - 1)) / (PALETTE.length - 1)),
    );

    const bg = new Konva.Rect({ x: 0, y: 0, width, height, fill: PALETTE[0] });
    main.add(bg);

    const ringCount = 5;
    const rings: Konva.Circle[] = [];
    for (let i = 0; i < ringCount; i++) {
      const ring = new Konva.Circle({
        x: width / 2,
        y: height / 2,
        radius: 40 + i * 36,
        stroke: "#fff",
        strokeWidth: 6,
        opacity: 0.85,
      });
      rings.push(ring);
      main.add(ring);
    }

    const blob = new Konva.Circle({
      x: width / 2,
      y: height / 2,
      radius: 60,
      fill: "#fff",
      shadowBlur: 30,
      shadowColor: "#000",
      shadowOpacity: 0.35,
    });
    main.add(blob);

    main.register((frame) => {
      bg.fill(interpolateColors(frame, bgKeyframes, PALETTE));

      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i] as Konva.Circle;
        const shifted = (frame + (i * duration) / ringCount) % duration;
        ring.stroke(interpolateColors(shifted, bgKeyframes, PALETTE));
      }

      blob.fill(
        interpolateColors(
          frame,
          [0, duration / 2, duration - 1],
          ["white", "rgba(255, 255, 255, 0.2)", "white"],
        ),
      );
      const scale = interpolate(frame, [0, duration / 2, duration - 1], [1, 1.4, 1], {
        easing: Easing.inOut(Easing.sin),
      });
      blob.scale({ x: scale, y: scale });
    });

    comp.add(main);
    return comp;
  },
};
