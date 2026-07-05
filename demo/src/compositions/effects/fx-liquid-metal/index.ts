import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-liquid-metal",
  title: "Liquid metal · foundry",
  group: "Effects",
  description:
    "A monogram cast in chrome: stripes pour through the glyph's Poisson edge field while the light walks around the mark.",
  tags: ["effect", "source", "image"],
  composition: () => import("./composition.js"),
};

export default entry;
