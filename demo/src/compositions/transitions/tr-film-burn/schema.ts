import { kf } from "@konva-motion/studio";

export type FilmBurnProps = { seed: number };

export const schema = kf.object({
  fields: { seed: kf.number({ label: "Seed", min: 0, max: 10, step: 0.01, default: 2.31 }) },
});

export const defaults: FilmBurnProps = { seed: 2.31 };
