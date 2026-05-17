import { Composition, Sequence } from "@konva-motion/core";
import { FlexGroup, initYoga } from "@konva-motion/layout";
import { bindLayout } from "@konva-motion/layout/sequence";
import Konva from "konva";
import type { DemoDef } from "./types.js";

const yogaReady = initYoga();

export const flexLayoutDemo: DemoDef = {
  id: "flex-layout",
  name: "Flex layout — animated row",
  build(container, width, height) {
    const duration = 120;
    const comp = new Composition({
      id: "flex-layout",
      fps: 30,
      durationInFrames: duration,
      container,
      width,
      height,
      loop: true,
    });

    const main = new Sequence({ from: 0, durationInFrames: duration });
    main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

    const rowHeight = 80;
    const startWidth = Math.min(360, width - 80);
    const endWidth = width - 40;
    const row = new FlexGroup({
      x: 20,
      y: (height - rowHeight) / 2,
      width: startWidth,
      height: rowHeight,
      flexDirection: "row",
      gap: 12,
      padding: 12,
      alignItems: "stretch",
    });

    // biome-ignore lint/suspicious/noExplicitAny: flex props live on attrs, outside Konva's typed config.
    row.add(new Konva.Rect({ fill: "#ff6b6b", height: 40, flexGrow: 1 } as any));
    // biome-ignore lint/suspicious/noExplicitAny: see above.
    row.add(new Konva.Rect({ fill: "#4ea1ff", width: 80, height: 40, flexGrow: 0 } as any));
    // biome-ignore lint/suspicious/noExplicitAny: see above.
    row.add(new Konva.Rect({ fill: "#ffd166", height: 40, flexGrow: 2 } as any));

    main.add(row);
    comp.add(main);

    let ready = false;
    yogaReady.then(() => {
      ready = true;
      row.computeLayout();
      main.batchDraw();
    });

    main.register((frame) => {
      if (!ready) return;
      const t = frame / (duration - 1);
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * 2 * t);
      row.width(startWidth + (endWidth - startWidth) * eased);
    });

    bindLayout(main, row);

    return comp;
  },
};
