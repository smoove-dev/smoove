import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "easings",
  title: "Race of curves",
  group: "Basics",
  description:
    "Several easing curves race left-to-right so you can feel the difference between them.",
  tags: ["easing", "compare"],
  composition: () => import("./composition.js"),
};

export default entry;
