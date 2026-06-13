import { kf } from "@konva-motion/studio";
import { ACCENTS } from "../accents.js";

export type Stripe = { color: string; label: string };
export type RibbonProps = {
  headline: string;
  align: "left" | "center" | "right";
  accent: string;
  showStripes: boolean;
  stripes: Stripe[];
  badges: string[];
};

export const schema = kf.object({
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
});
