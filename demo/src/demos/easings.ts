import { Composition, Easing, Sequence, interpolate } from "@konva-motion/core";
import Konva from "konva";
import type { DemoDef } from "./types.js";

type Row = { label: string; easing: (n: number) => number };

const ROWS: Row[] = [
  { label: "linear", easing: Easing.linear },
  { label: "Easing.in(cubic)", easing: Easing.in(Easing.cubic) },
  { label: "Easing.out(cubic)", easing: Easing.out(Easing.cubic) },
  { label: "Easing.inOut(cubic)", easing: Easing.inOut(Easing.cubic) },
  { label: "Easing.elastic(1)", easing: Easing.out(Easing.elastic(1)) },
  { label: "Easing.bounce", easing: Easing.out(Easing.bounce) },
  { label: "Easing.bezier(.5,0,.5,1)", easing: Easing.bezier(0.5, 0, 0.5, 1) },
];

export const easingsDemo: DemoDef = {
  id: "easings",
  name: "Easings — race of curves",
  build(container, width, height) {
    const duration = 120;
    const comp = new Composition({
      id: "easings",
      fps: 30,
      durationInFrames: duration,
      container,
      width,
      height,
      loop: true,
    });

    const main = new Sequence({ from: 0, durationInFrames: duration });
    main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

    const leftPad = 200;
    const rightPad = 60;
    const trackLeft = leftPad;
    const trackRight = width - rightPad;
    const rowHeight = (height - 40) / ROWS.length;

    for (let i = 0; i < ROWS.length; i++) {
      const row = ROWS[i] as Row;
      const y = 20 + rowHeight * (i + 0.5);

      main.add(
        new Konva.Line({
          points: [trackLeft, y, trackRight, y],
          stroke: "#1f2933",
          strokeWidth: 2,
        }),
      );
      main.add(
        new Konva.Text({
          x: 12,
          y: y - 8,
          width: leftPad - 24,
          text: row.label,
          fill: "#9aa5b1",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
          align: "right",
        }),
      );

      const dot = new Konva.Circle({
        x: trackLeft,
        y,
        radius: 10,
        fill: "#4ea1ff",
        stroke: "#fff",
        strokeWidth: 1.5,
      });
      main.add(dot);

      main.register((frame) => {
        dot.x(
          interpolate(frame, [0, duration - 1], [trackLeft, trackRight], {
            easing: row.easing,
            extrapolateRight: "clamp",
          }),
        );
      });
    }

    comp.add(main);
    return comp;
  },
};
