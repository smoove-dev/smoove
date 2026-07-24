import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "clip-timelines",
  title: "Nested timelines",
  group: "Components",
  description:
    "Clip windows visualized as lanes: plain from/duration, a marker-anchored lane, and nested clips with local clocks — including one cut short by its parent closing.",
  tags: ["components", "clip", "timeline", "markers"],
  composition: () => import("./composition.js"),
};

export default entry;
