import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-warp",
  title: "Warp · soie",
  group: "Effects",
  description:
    "A fashion-house ident: checks liquefy into stripes into raw edges as the swirl kneads the silk.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
