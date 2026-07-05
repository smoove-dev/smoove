import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-metaballs",
  title: "Metaballs · mitosis",
  group: "Effects",
  description:
    "Life under the microscope: one cell divides into fourteen and merges back — count and ballSize tell the story.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
