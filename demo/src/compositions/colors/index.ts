import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "colors",
  title: "Color interpolation",
  group: "Basics",
  description: "Fill and stroke colors interpolate through a palette via interpolateColors.",
  tags: ["color", "interpolate"],
  composition: () => import("./composition.js"),
};

export default entry;
