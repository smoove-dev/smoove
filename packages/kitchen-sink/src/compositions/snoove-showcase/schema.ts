import { kf } from "@smoove/studio";

export type SmooveShowcaseProps = {
  greeting: string;
  name: string;
  tagline: string;
};

export const schema = kf.object({
  fields: {
    greeting: kf.text({
      label: "Greeting",
      default: "Hi",
    }),
    name: kf.text({
      label: "Name",
      default: "there",
    }),
    tagline: kf.text({
      label: "Tagline",
      default: "Smooth moves, in code.",
    }),
  },
});
