import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-voronoi",
  title: "Voronoi · rose window",
  group: "Effects",
  description:
    "Stained glass being leaded: gaps widen into black cames, sunlight glows through, then it all re-melts.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
