import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "code",
  title: "Animated code",
  group: "Text",
  description:
    "@smoove/code morphs between source snapshots with a syntax-highlighted diff, driven purely by the frame.",
  tags: ["code", "diff", "lezer"],
  composition: () => import("./composition.js"),
};

export default entry;
