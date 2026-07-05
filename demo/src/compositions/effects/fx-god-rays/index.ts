import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-god-rays",
  title: "God rays · dawn",
  group: "Effects",
  description:
    "First light over a ridge: the sun's core swells above the frame while silhouette mountains hold the horizon.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
