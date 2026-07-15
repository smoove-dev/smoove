import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "code-select",
  title: "Code selection",
  group: "Text",
  description:
    "Keep a range lit and dim the rest, animated with interpolateSelection over the ranges of a match.",
  tags: ["code", "selection"],
  composition: () => import("./composition.js"),
};

export default entry;
