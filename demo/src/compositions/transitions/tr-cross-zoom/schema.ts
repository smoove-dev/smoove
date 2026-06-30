import { kf } from "@smoove/studio";

export type CrossZoomProps = { strength: number };

export const schema = kf.object({
  fields: { strength: kf.number({ label: "Strength", min: 0, max: 2, step: 0.05, default: 0.4 }) },
});

export const defaults: CrossZoomProps = { strength: 0.4 };
