import { Block, Composition, Easing, Sequence, Text, interpolate } from "@konva-motion/core";
import Konva from "konva";
import type { DemoDef } from "./types.js";

const MUTED = "#7d8590";
const FONT = "ui-sans-serif, system-ui, sans-serif";

function label(text: string, x: number, y: number): Konva.Text {
  return new Konva.Text({ x, y, text, fontSize: 12, fontFamily: FONT, fill: MUTED });
}

/**
 * `fitText` showcase — auto font-sizing inside `Block`/`Flex`, on a box whose
 * size animates, plus single vs multi-line, `maxLines`, and `maxWidth`/`maxHeight`.
 */
export const textFitDemo: DemoDef = {
  id: "text-fit",
  name: "Text · fitText",
  build() {
    const fps = 30;
    const duration = 150;

    const width = 512;
    const height = 512;

    const comp = new Composition({
      id: "text-fit",
      fps,
      durationInFrames: duration,
      width,
      height,
      loop: true,
    });

    const main = new Sequence({ from: 0, durationInFrames: duration });
    main.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#0d1117" }));

    const M = 24;
    const colW = width - M * 2;

    // 1. fitText inside a Block whose width animates — the font keeps fitting.
    main.add(label("fitText + Block — animated width, single line (wrap: none)", M, 16));
    const box1 = new Block({
      x: M,
      y: 34,
      flexDirection: "column",
      justifyContent: "center",
      padding: 14,
      background: "#161b22",
      borderSize: 1,
      borderColor: "#30363d",
      cornerRadius: 12,
    });
    box1.add(
      new Text({
        width: "100%",
        text: "I always fit the box",
        fitText: { min: 8, max: 44 },
        wrap: "none",
        align: "center",
        fontStyle: "bold",
        fontFamily: FONT,
        fill: "#4ea1ff",
      }),
    );
    main.add(box1);

    // 2. Single-line vs multi-line fit in the same fixed box width.
    const halfW = (colW - 16) / 2;
    const y2 = 150;
    main.add(label("single-line fit (wrap: none)", M, y2));
    main.add(label("multi-line fit (wrap: word)", M + halfW + 16, y2));
    const SENTENCE = "Fit this whole sentence inside the box";
    const single = new Block({
      x: M,
      y: y2 + 18,
      width: halfW,
      height: 96,
      flexDirection: "column",
      justifyContent: "center",
      padding: 10,
      background: "#161b22",
      borderSize: 1,
      borderColor: "#30363d",
      cornerRadius: 10,
    });
    single.add(
      new Text({
        width: "100%",
        text: SENTENCE,
        fitText: { min: 6, max: 40 },
        wrap: "none",
        align: "center",
        fontFamily: FONT,
        fill: "#e6edf3",
      }),
    );
    main.add(single);
    const multi = new Text({
      x: M + halfW + 16,
      y: y2 + 18,
      width: halfW,
      height: 96,
      text: SENTENCE,
      fitText: { min: 6, max: 40 },
      align: "center",
      fontFamily: FONT,
      fill: "#e6edf3",
    });
    // Visual box behind the multi-line fit.
    main.add(
      new Konva.Rect({
        x: M + halfW + 16,
        y: y2 + 18,
        width: halfW,
        height: 96,
        fill: "#161b22",
        stroke: "#30363d",
        strokeWidth: 1,
        cornerRadius: 10,
      }),
    );
    main.add(multi);

    // 3. maxLines + ellipsis (fixed font, trimmed to N lines).
    const y3 = 286;
    main.add(label("maxLines: 2 + ellipsis (trimBy: word)", M, y3));
    main.add(
      new Text({
        x: M,
        y: y3 + 18,
        width: colW,
        text: "This sentence is comfortably longer than two lines, so it is trimmed back to the last whole word and an ellipsis is appended.",
        maxLines: 2,
        fontSize: 18,
        lineHeight: 1.4,
        fontFamily: FONT,
        fill: "#e6edf3",
      }),
    );

    // 4. maxWidth + maxHeight — hug up to maxWidth, clamp at maxHeight.
    const y4 = 364;
    main.add(label("maxWidth: 260 + maxHeight: 64 (hug, then clamp)", M, y4));
    main.add(
      new Konva.Rect({
        x: M,
        y: y4 + 18,
        width: 260,
        height: 64,
        stroke: "#30363d",
        strokeWidth: 1,
        cornerRadius: 8,
      }),
    );
    main.add(
      new Text({
        x: M + 8,
        y: y4 + 18 + 8,
        maxWidth: 244,
        maxHeight: 48,
        text: "maxWidth wraps this text and maxHeight clamps it with an ellipsis once it runs out of room.",
        fontSize: 16,
        lineHeight: 1.4,
        fontFamily: FONT,
        fill: "#e6edf3",
      }),
    );

    main.register((local) => {
      // Pulse the first box width between 40% and 100% of the column.
      const t = interpolate(local, [0, duration / 2, duration], [0, 1, 0], {
        easing: Easing.inOut(Easing.cubic),
      });
      box1.setAttr("flexWidth", Math.round(colW * (0.4 + 0.6 * t)));
    });

    comp.add(main);
    return comp;
  },
};
