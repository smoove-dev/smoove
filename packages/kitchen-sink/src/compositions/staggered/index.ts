import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "staggered",
  title: "Staggered fade-in",
  group: "Basics",
  description:
    "A row of cards fades and rises in along a stagger — the building block for list intros.",
  tags: ["stagger", "fade"],
  composition: () => import("./composition.js"),
};

export default entry;
