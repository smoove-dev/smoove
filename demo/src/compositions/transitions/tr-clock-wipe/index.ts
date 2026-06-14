import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "tr-clock-wipe",
  title: "Clock wipe",
  group: "Transitions",
  description: "Angular pie-sweep clip from 12 o'clock.",
  tags: ["transition", "geometric"],
  composition: () => import("./composition.js"),
};

export default entry;
