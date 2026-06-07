import { Composition, Sequence } from "@konva-motion/core";
import Konva from "konva";
import type { DemoDef } from "./types.js";

export const basicDemo: DemoDef = {
  id: "basic",
  name: "Basic — circle + fade",
  build() {
    const width = 1280;
    const height = 720;
    const comp = new Composition({
      id: "basic",
      fps: 30,
      durationInFrames: 90,
      width,
      height,
    });

    const main = new Sequence({ from: 0, durationInFrames: 90 });
    main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));
    const circle = new Konva.Circle({
      x: 100,
      y: height / 2,
      radius: 60,
      fill: "#4ea1ff",
      stroke: "#fff",
      strokeWidth: 2,
    });
    main.add(circle);
    comp.add(main);
    main.register((frame) => {
      circle.x(100 + frame * (width - 200) * (1 / 90));
    });

    const fade = new Sequence({ from: 30, durationInFrames: 60 });
    const square = new Konva.Rect({
      x: width / 2 - 50,
      y: height / 2 - 50,
      width: 100,
      height: 100,
      fill: "#ff6b6b",
    });
    fade.add(square);
    comp.add(fade);
    fade.register((local) => {
      square.opacity(1 - local / 60);
    });

    return comp;
  },
};
