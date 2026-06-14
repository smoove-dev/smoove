import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "text-highlight",
  title: "Text highlight",
  group: "Text",
  description:
    "Animated marker highlights sweep across phrases — rounded pills, partial fills and per-range styling.",
  tags: ["text", "highlight", "marker"],
  composition: () => import("./composition.js"),
};

export default entry;
