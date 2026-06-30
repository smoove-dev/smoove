import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "tr-clock-wipe",
  title: "Clock wipe",
  group: "Transitions",
  description: "Angular pie-sweep clip from 12 o'clock.",
  tags: ["transition", "geometric"],
  composition: () => import("./composition.js"),
};

export default entry;
