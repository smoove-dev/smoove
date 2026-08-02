import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "lottie",
  title: "Lottie",
  group: "Media",
  description:
    "@smoove/lottie plays After Effects animations off the composition clock, resampling the animation's own frame rate onto yours.",
  tags: ["lottie", "dotlottie", "media"],
  composition: () => import("./composition.js"),
};

export default entry;
