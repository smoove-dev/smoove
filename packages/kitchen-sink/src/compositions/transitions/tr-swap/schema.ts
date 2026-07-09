import { kf } from "@smoove/studio";

export type SwapProps = {
  reflection: number;
  perspective: number;
  depth: number;
};

export const schema = kf.object({
  fields: {
    reflection: kf.number({ label: "Reflection", min: 0, max: 1, step: 0.05, default: 0.4 }),
    perspective: kf.number({ label: "Perspective", min: 0, max: 1, step: 0.05, default: 0.2 }),
    depth: kf.number({ label: "Depth", min: 1, max: 6, step: 0.1, default: 3 }),
  },
});

export const defaults: SwapProps = {
  reflection: 0.4,
  perspective: 0.2,
  depth: 3,
};
