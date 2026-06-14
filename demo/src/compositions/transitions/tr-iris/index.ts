import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "tr-iris",
  title: "Iris",
  group: "Transitions",
  description: "Expanding circular clip from the centre.",
  tags: ["transition", "geometric"],
  composition: () => import("./composition.js"),
};

export default entry;
