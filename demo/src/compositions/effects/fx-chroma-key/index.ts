import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-chroma-key",
  title: "Chroma key",
  group: "Effects",
  description:
    "Green-screen keying on a whole Sequence: spinning, orbiting subjects composite over the backdrop in one layer pass, with an unkeyed source inset.",
  tags: ["effects", "chroma-key", "green-screen"],
  composition: () => import("./composition.js"),
};

export default entry;
