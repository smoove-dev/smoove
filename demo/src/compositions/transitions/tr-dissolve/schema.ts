import { kf } from "@smoove/studio";

export type DissolveProps = {
  lineWidth: number;
  spreadColor: string;
  hotColor: string;
  pow: number;
  intensity: number;
};

export const schema = kf.object({
  fields: {
    lineWidth: kf.number({ label: "Line width", min: 0, max: 1, step: 0.01, default: 0.1 }),
    spreadColor: kf.color({ label: "Spread color", default: "#ff0000" }),
    hotColor: kf.color({ label: "Hot color", default: "#e6e633" }),
    pow: kf.number({ label: "Power", min: 0, max: 10, step: 0.1, default: 5 }),
    intensity: kf.number({ label: "Intensity", min: 0, max: 3, step: 0.05, default: 1 }),
  },
});

export const defaults: DissolveProps = {
  lineWidth: 0.1,
  spreadColor: "#ff0000",
  hotColor: "#e6e633",
  pow: 5,
  intensity: 1,
};
