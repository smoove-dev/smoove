import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-heatmap-logo",
  title: "Heatmap · afterburn",
  group: "Effects",
  description:
    "The paper-design heatmap logo animation: a mark ignites to white-hot through its multi-scale blur field, then cools to embers.",
  tags: ["effect", "source", "image"],
  composition: () => import("./composition.js"),
};

export default entry;
