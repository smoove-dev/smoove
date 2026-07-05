import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-dot-orbit",
  title: "Dot orbit · dance floor",
  group: "Effects",
  description:
    "A club floor at 124 BPM: dot size pumps on the kick and spreading loosens the crowd.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
