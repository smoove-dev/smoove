import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-simplex-noise",
  title: "Simplex noise · elevation",
  group: "Effects",
  description:
    "A survey map draws its contours: the smooth field quantizes into crisp altitude bands and melts back.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
