import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "droplets-video",
  title: "Droplets on video",
  group: "Effects",
  description:
    "droplets on a Video node: the footage runs behind a rained-on pane while the caption on top stays sharp, because an effect only touches the node it is on.",
  tags: ["effects", "shader", "rain", "video"],
  composition: () => import("./composition.js"),
};

export default entry;
