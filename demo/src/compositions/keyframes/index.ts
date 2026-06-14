import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "keyframes",
  title: "Multi-stop interpolate",
  group: "Basics",
  description: "A node follows a path defined by multiple interpolate stops for x and y.",
  tags: ["keyframes", "interpolate", "path"],
  composition: () => import("./composition.js"),
};

export default entry;
