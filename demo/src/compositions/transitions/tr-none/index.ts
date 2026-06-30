import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "tr-none",
  title: "None",
  group: "Transitions",
  description: "Hard cut — no transform, incoming replaces outgoing.",
  tags: ["transition", "geometric"],
  composition: () => import("./composition.js"),
};

export default entry;
