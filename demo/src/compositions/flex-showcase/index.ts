import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "flex-showcase",
  title: "Feature showcase",
  group: "Layout",
  description:
    "justifyContent, alignItems, flexGrow and gap all animate in sequence to showcase the layout engine.",
  tags: ["flex", "showcase"],
  composition: () => import("./composition.js"),
};

export default entry;
