import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "flame-wrap",
  title: "Flame wrap",
  group: "Effects",
  description:
    "flameWrap sets a card on fire: flames wrap the node's rounded box, eat into its edge and light what survives, with heat distortion and sparks. Animate `intensity` to ignite.",
  tags: ["effects", "shader", "fire"],
  composition: () => import("./composition.js"),
};

export default entry;
