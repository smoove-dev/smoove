import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-pixelate",
  title: "Pixelate · declassified",
  group: "Effects",
  description:
    "An intelligence photo decrypts from a 90px mosaic to a single pixel, gets stamped, and re-censors itself.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
