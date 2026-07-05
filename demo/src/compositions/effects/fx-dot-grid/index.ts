import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-dot-grid",
  title: "Dot grid · halftone press",
  group: "Effects",
  description:
    "A print-shop proof: the grid breathes, the die cycles through all four shapes, and mis-registration sweeps in.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
