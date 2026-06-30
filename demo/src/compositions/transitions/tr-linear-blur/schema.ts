import { kf } from "@smoove/studio";

export type LinearBlurProps = { intensity: number };

export const schema = kf.object({
  fields: {
    intensity: kf.number({ label: "Intensity", min: 0, max: 1, step: 0.01, default: 0.1 }),
  },
});

export const defaults: LinearBlurProps = { intensity: 0.1 };
