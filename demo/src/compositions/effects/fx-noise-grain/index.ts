import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-noise-grain",
  title: "Noise grain · super 8",
  group: "Effects",
  description:
    "A home-movie leader card through a tired projector: layer-wide grain, lamp flicker, gate weave and light leaks — all frame-seeded.",
  tags: ["effect", "filter", "layer"],
  composition: () => import("./composition.js"),
};

export default entry;
