import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "tr-crosswarp",
  title: "Crosswarp · shader",
  group: "Transitions",
  description: "Warping cross-dissolve.",
  tags: ["transition", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
