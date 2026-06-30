import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "transforms",
  title: "Rotate + scale",
  group: "Basics",
  description: "Rotation and scale animated together, capped by a small particle burst.",
  tags: ["transform", "rotate", "scale"],
  composition: () => import("./composition.js"),
};

export default entry;
