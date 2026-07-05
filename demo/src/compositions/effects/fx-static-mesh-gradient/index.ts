import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-static-mesh-gradient",
  title: "Static mesh gradient · still life",
  group: "Effects",
  description:
    "A gallery of one painting rehung six times — the positions seed recomposes the whole canvas per plate.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
