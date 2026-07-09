import { kf } from "@smoove/studio";
import { ACCENTS } from "../accents.js";

export type PlaygroundProps = {
  frameWidth: number;
  gap: number;
  padding: number;
  direction: string;
  justify: string;
  align: string;
  aWidth: number;
  aHeight: number;
  bWidth: number;
  bHeight: number;
  cGrow: number;
  accent: string;
};

export const schema = kf.object({
  fields: {
    frameWidth: kf.number({
      label: "Frame width",
      min: 400,
      max: 1200,
      step: 10,
      default: 1000,
      unit: "px",
    }),
    gap: kf.number({ label: "Gap", min: 0, max: 80, step: 2, default: 24, unit: "px" }),
    padding: kf.number({ label: "Padding", min: 0, max: 60, step: 2, default: 24, unit: "px" }),
    direction: kf.select({
      label: "Direction",
      default: "row",
      options: [
        { value: "row", label: "Row" },
        { value: "column", label: "Column" },
      ],
    }),
    justify: kf.select({
      label: "Justify",
      default: "flex-start",
      options: [
        { value: "flex-start", label: "Start" },
        { value: "center", label: "Center" },
        { value: "flex-end", label: "End" },
        { value: "space-between", label: "Space between" },
        { value: "space-around", label: "Space around" },
        { value: "space-evenly", label: "Space evenly" },
      ],
    }),
    align: kf.select({
      label: "Align",
      default: "center",
      options: [
        { value: "flex-start", label: "Start" },
        { value: "center", label: "Center" },
        { value: "flex-end", label: "End" },
        { value: "stretch", label: "Stretch" },
      ],
    }),
    accent: kf.color({ label: "Accent", default: "#7c5cff", swatches: ACCENTS }),

    dividerA: kf.divider({ label: "Box A — rectangle (drag to resize)" }),
    aWidth: kf.number({ label: "A width", min: 40, max: 520, step: 4, default: 180, unit: "px" }),
    aHeight: kf.number({ label: "A height", min: 40, max: 360, step: 4, default: 180, unit: "px" }),

    dividerB: kf.divider({ label: "Box B — ellipse (drag to resize)" }),
    bWidth: kf.number({ label: "B width", min: 40, max: 520, step: 4, default: 180, unit: "px" }),
    bHeight: kf.number({ label: "B height", min: 40, max: 360, step: 4, default: 180, unit: "px" }),

    dividerC: kf.divider({ label: "Box C — elastic (flexGrow)" }),
    cGrow: kf.number({ label: "C grow", min: 0, max: 5, step: 1, default: 1 }),
  },
});
