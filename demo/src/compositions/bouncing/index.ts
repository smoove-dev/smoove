import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "bouncing",
  title: "Bouncing ball",
  group: "Basics",
  description: "A looping ball with eased fall and squash/stretch on impact — a primer on easing.",
  tags: ["motion", "easing", "loop"],
  composition: () => import("./composition.js"),
};

export default entry;
