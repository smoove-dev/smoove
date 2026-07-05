import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-chromatic-aberration",
  title: "Chromatic aberration · signal lost",
  group: "Effects",
  description:
    "A broadcast glitch: RGB channels tear on every beat, the split axis whips around, slice bars flash.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
