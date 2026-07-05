import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-neuro-noise",
  title: "Neuro noise · synapse",
  group: "Effects",
  description:
    "Thoughts firing in the dark: glowing threads pulse with action potentials while a scanline reads the activity.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
