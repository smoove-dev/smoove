import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-blur",
  title: "Blur",
  group: "Effects",
  description:
    "A moving bokeh field: 8 orbiting orbs each with a pulsing per-node blur, behind a focus-pulling title.",
  tags: ["effects", "blur", "loop"],
  composition: () => import("./composition.js"),
};

export default entry;
