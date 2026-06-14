import { kf } from "@konva-motion/studio";

export type DreamyZoomProps = {
  rotation: number;
  scale: number;
};

export const schema = kf.object({
  fields: {
    rotation: kf.number({ label: "Rotation", min: 0, max: 30, step: 0.5, default: 6, unit: "°" }),
    scale: kf.number({ label: "Scale", min: 1, max: 3, step: 0.05, default: 1.2 }),
  },
});

export const defaults: DreamyZoomProps = {
  rotation: 6,
  scale: 1.2,
};
