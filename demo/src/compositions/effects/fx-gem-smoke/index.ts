import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-gem-smoke",
  title: "Gem smoke · incense",
  group: "Effects",
  description:
    "A diamond mark exhaling: soft ink curls through and past the shape's edge field in one long breath per loop.",
  tags: ["effect", "source", "image"],
  composition: () => import("./composition.js"),
};

export default entry;
