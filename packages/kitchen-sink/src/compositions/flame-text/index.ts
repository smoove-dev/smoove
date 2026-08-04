import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "flame-text",
  title: "Flame text",
  group: "Effects",
  description:
    'flameWrap in `shape: "silhouette"`: the same fire, but the outline comes from the node\'s own alpha, so a title burns letter by letter.',
  tags: ["effects", "shader", "fire", "text"],
  composition: () => import("./composition.js"),
};

export default entry;
