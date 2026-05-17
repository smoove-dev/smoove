import { Composition, Easing, Sequence, interpolate, interpolateColors } from "@konva-motion/core";
import Konva from "konva";
import type { DemoDef } from "./types.js";

export const keyframesDemo: DemoDef = {
  id: "keyframes",
  name: "Keyframes — multi-stop interpolate",
  build(container, width, height) {
    const duration = 150;
    const comp = new Composition({
      id: "keyframes",
      fps: 30,
      durationInFrames: duration,
      container,
      width,
      height,
      loop: true,
    });

    const main = new Sequence({ from: 0, durationInFrames: duration });
    main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

    // Trail of the keyframe path.
    const stops = [0, 30, 60, 90, 120, 149];
    const xs = [width * 0.1, width * 0.3, width * 0.5, width * 0.7, width * 0.9, width * 0.5];
    const ys = [height * 0.5, height * 0.2, height * 0.8, height * 0.2, height * 0.5, height * 0.5];

    // Render keyframe markers so the path is visible.
    for (let i = 0; i < stops.length; i++) {
      main.add(
        new Konva.Circle({
          x: xs[i],
          y: ys[i],
          radius: 6,
          fill: "#1f2933",
          stroke: "#4ea1ff",
          strokeWidth: 2,
        }),
      );
    }

    const rotations = [0, 90, 180, 270, 360, 360];
    const scales = [1, 1.4, 0.8, 1.4, 1, 1];

    const star = new Konva.Star({
      x: xs[0] as number,
      y: ys[0] as number,
      numPoints: 5,
      innerRadius: 18,
      outerRadius: 36,
      fill: "#ffd166",
      stroke: "#fff",
      strokeWidth: 2,
    });
    main.add(star);

    const label = new Konva.Text({
      x: 16,
      y: 16,
      text: "",
      fill: "#9aa5b1",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
    });
    main.add(label);

    main.register((frame) => {
      const x = interpolate(frame, stops, xs, {
        easing: Easing.inOut(Easing.cubic),
      });
      const y = interpolate(frame, stops, ys, {
        easing: Easing.inOut(Easing.cubic),
      });
      const rot = interpolate(frame, stops, rotations, { easing: Easing.inOut(Easing.quad) });
      const scale = interpolate(frame, stops, scales, {
        easing: Easing.out(Easing.elastic(1)),
      });

      star.position({ x, y });
      star.rotation(rot);
      star.scale({ x: scale, y: scale });
      star.fill(
        interpolateColors(frame, stops, [
          "#ffd166",
          "#ff6b6b",
          "#06d6a0",
          "#118ab2",
          "#9b5de5",
          "#ffd166",
        ]),
      );

      label.text(`frame ${frame} / ${duration - 1}`);
    });

    comp.add(main);
    return comp;
  },
};
