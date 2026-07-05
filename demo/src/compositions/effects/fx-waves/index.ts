import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-waves",
  title: "Waves · LP 002",
  group: "Effects",
  description:
    "An album cover pressing itself: the sleeve sweeps Waves' whole shape dial from zigzag to broken sine.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
