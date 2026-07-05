import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-grain-gradient",
  title: "Grain gradient · seven rooms",
  group: "Effects",
  description:
    "One grainy gradient, seven procedural shapes — a room per second, each arriving crisp and melting soft.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
