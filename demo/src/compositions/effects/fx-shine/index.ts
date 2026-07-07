import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-shine",
  title: "Shine",
  group: "Effects",
  description:
    "Staggered highlight sweeps — a gold card, its label, and a shelf of bobbing medals, each band clipping to its own node's alpha.",
  tags: ["effects", "shine", "sweep", "loop"],
  composition: () => import("./composition.js"),
};

export default entry;
