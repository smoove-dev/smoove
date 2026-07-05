import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-neon",
  title: "Neon · arcade attract",
  group: "Effects",
  description:
    "An arcade attract screen: NeonEffect tubes with hot white cores, and INSERT COIN running the effect's built-in deterministic flicker.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
