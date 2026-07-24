import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "smoove-showcase",
  title: "smoove showcase",
  group: "Showcase",
  description:
    "A 48s square cut: greeting, logo, auto layout, masked video, code, the mix, and the call to action.",
  tags: ["showcase", "square", "1080"],
  composition: () => import("./composition.js"),
};

export default entry;
