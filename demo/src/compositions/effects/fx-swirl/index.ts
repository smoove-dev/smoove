import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-swirl",
  title: "Swirl · vertigo",
  group: "Effects",
  description:
    "A title sequence that pulls you down the stairwell: twist winds tighter while the bands multiply.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
