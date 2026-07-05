import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-sparkle",
  title: "Sparkle · jewelry counter",
  group: "Effects",
  description:
    "Twinkling SparkleEffect glints over velvet lettering, chained with a slow ShineEffect sweep that makes the glints surge as it passes.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
