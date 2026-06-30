import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "tr-zoom-in-out",
  title: "Zoom in/out · shader",
  group: "Transitions",
  description: "Punch-in / punch-out crossfade.",
  tags: ["transition", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
