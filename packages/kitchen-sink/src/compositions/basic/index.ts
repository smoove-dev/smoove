import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "basic",
  title: "Circle + fade",
  group: "Basics",
  description: "The simplest build: a circle slides across while a square fades out. Start here.",
  tags: ["intro", "fade"],
  composition: () => import("./composition.js"),
};

export default entry;
