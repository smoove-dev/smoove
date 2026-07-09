import { kf } from "@smoove/studio";
import { ACCENTS } from "../accents.js";

export type PulseProps = {
  title: string;
  accent: string;
  count: number;
  size: number;
};

export const schema = kf.object({
  fields: {
    title: kf.text({ label: "Title", default: "Pulse" }),
    accent: kf.color({ label: "Accent", default: "#7c5cff", swatches: ACCENTS }),
    count: kf.number({ label: "Circles", min: 3, max: 12, step: 1, default: 6 }),
    size: kf.number({ label: "Base size", min: 20, max: 120, step: 2, default: 60, unit: "px" }),
  },
});
