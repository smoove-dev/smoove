import { kf } from "@konva-motion/studio";

export type RippleProps = {
  amplitude: number;
  speed: number;
};

export const schema = kf.object({
  fields: {
    amplitude: kf.number({ label: "Amplitude", min: 0, max: 300, step: 1, default: 100 }),
    speed: kf.number({ label: "Speed", min: 0, max: 200, step: 1, default: 50 }),
  },
});

export const defaults: RippleProps = {
  amplitude: 100,
  speed: 50,
};
