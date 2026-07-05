import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-holographic",
  title: "Holographic · foil card",
  group: "Effects",
  description:
    "A trading-card foil: HolographicEffect drifts rainbow bands across card and title while the sheen angle rocks like a tilted card.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
