import { kf } from "@smoove/studio";

export type HelloSmooveProps = {
  slogan: string;
};

export const schema = kf.object({
  fields: {
    slogan: kf.text({ label: "Slogan", default: "What you code is what you play." }),
  },
});
