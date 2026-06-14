import { kf } from "@konva-motion/studio";

export type ZoomBlurProps = { rotation: number };

export const schema = kf.object({
  fields: {
    rotation: kf.number({
      label: "Rotation",
      min: 0,
      max: 3.14,
      step: 0.05,
      default: 0.52,
      unit: "rad",
    }),
  },
});

export const defaults: ZoomBlurProps = { rotation: 0.52 };
