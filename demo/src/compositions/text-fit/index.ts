import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "text-fit",
  title: "Fit text",
  group: "Text",
  description:
    "fitText keeps a headline filling its box as the box width animates, then contrasts single-line vs multi-line fitting.",
  tags: ["text", "fit", "flex"],
  composition: () => import("./composition.js"),
};

export default entry;
