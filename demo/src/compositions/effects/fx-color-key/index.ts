import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-color-key",
  title: "Chroma key · on air",
  group: "Effects",
  description:
    "A broadcast studio keys its unevenly lit green screen live — watch ColorKeyEffect melt the green into a virtual set.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
