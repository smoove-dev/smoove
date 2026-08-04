import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "chroma-key",
  title: "Chroma key",
  group: "Effects",
  description:
    "chromaKey on a Video node: real green-screen footage, cropped to the screen and keyed onto a set, with the key dissolving in so the plate it started from is visible.",
  tags: ["effects", "shader", "green screen", "video"],
  composition: () => import("./composition.js"),
};

export default entry;
