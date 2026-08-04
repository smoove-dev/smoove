import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "droplets",
  title: "Droplets",
  group: "Effects",
  description:
    "droplets puts a rained-on window in front of a scene: drops swell, let go and slide, trails cut through the fog, and everything behind refracts. Animate `intensity` for a squall.",
  tags: ["effects", "shader", "rain", "glass"],
  composition: () => import("./composition.js"),
};

export default entry;
