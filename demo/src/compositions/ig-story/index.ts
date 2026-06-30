import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "ig-story",
  title: "IG Story · 30s",
  group: "Layout",
  description:
    "A ten-scene 9:16 vertical story reel — kinetic type, stickers and transitions, locked to portrait.",
  tags: ["portrait", "story", "kinetic"],
  composition: () => import("./composition.js"),
};

export default entry;
