import { defineRegistry, kf } from "@konva-motion/studio";
import { pulse } from "./compositions/pulse.js";
import { ribbon } from "./compositions/ribbon.js";

const ACCENTS = ["#7c5cff", "#2bd9c4", "#ff8a3d", "#ff5d8f", "#56b8ff"];

/** demo2's registry — two fresh, props-driven compositions (nothing ported). */
export const registry = defineRegistry([
  {
    id: "pulse",
    title: "Pulse",
    // group: "Motion",
    description:
      "A row of circles pulsing on a sine wave — edit the props to see the preview react live.",
    tags: ["motion", "loop", "props"],
    load: pulse,
    propsSchema: kf.object({
      fields: {
        title: kf.text({ label: "Title", default: "Pulse" }),
        accent: kf.color({ label: "Accent", default: "#7c5cff", swatches: ACCENTS }),
        count: kf.number({ label: "Circles", min: 3, max: 12, step: 1, default: 6 }),
        size: kf.number({
          label: "Base size",
          min: 20,
          max: 120,
          step: 2,
          default: 60,
          unit: "px",
        }),
      },
    }),
  },
  {
    id: "ribbon",
    title: "Ribbon",
    group: "Text",
    description:
      "Sweeping color ribbons behind an animated headline, with badges. Exercises every props-form field type.",
    tags: ["text", "layout", "props"],
    load: ribbon,
    propsSchema: kf.object({
      fields: {
        headline: kf.multiline({ label: "Headline", default: "Ribbon", rows: 2 }),
        align: kf.select({
          label: "Align",
          default: "center",
          options: [
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ],
        }),
        accent: kf.color({
          label: "Headline color",
          default: "#ffffff",
          swatches: ["#ffffff", ...ACCENTS],
        }),
        d1: kf.divider({ label: "Ribbons" }),
        showStripes: kf.boolean({ label: "Show ribbons", default: true }),
        stripes: kf.array({
          label: "Ribbons",
          itemLabel: "Ribbon",
          min: 1,
          max: 8,
          default: [
            { color: "#7c5cff", label: "one" },
            { color: "#2bd9c4", label: "two" },
            { color: "#ff8a3d", label: "three" },
          ],
          of: kf.object({
            fields: {
              color: kf.color({ label: "Color", default: "#7c5cff", swatches: ACCENTS }),
              label: kf.text({ label: "Label", default: "stripe" }),
            },
          }),
        }),
        d2: kf.divider({ label: "Meta" }),
        badges: kf.multiselect({
          label: "Badges",
          default: ["motion", "konva"],
          options: [
            { value: "new", label: "new" },
            { value: "motion", label: "motion" },
            { value: "konva", label: "konva" },
            { value: "studio", label: "studio" },
          ],
        }),
      },
    }),
  },
]);
