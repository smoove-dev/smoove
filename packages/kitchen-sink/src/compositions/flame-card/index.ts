import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "flame-card",
  title: "Flame card",
  group: "Effects",
  description:
    "flameWrap on a rounded card: the fire follows the card's edge, the content inside stays readable, and `scorch` chars it as it burns.",
  tags: ["effects", "shader", "fire", "card"],
  composition: () => import("./composition.js"),
};

export default entry;
