import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-water",
  title: "Water",
  group: "Effects",
  description:
    "Caustic water distortion over spinning, drifting shapes — a shader pass per shape through the shared GL bridge.",
  tags: ["effects", "water", "shader", "loop"],
  composition: () => import("./composition.js"),
};

export default entry;
