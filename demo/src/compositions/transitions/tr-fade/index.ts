import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "tr-fade",
  title: "Fade",
  group: "Transitions",
  description: "Opacity cross-dissolve — both layers reach 50% at the midpoint.",
  tags: ["transition", "geometric"],
  composition: () => import("./composition.js"),
};

export default entry;
