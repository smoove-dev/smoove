import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-perlin-noise",
  title: "Perlin noise · octaves",
  group: "Effects",
  description:
    "How detail is built: the field gains one octave per second, 1 → 8, with a counter and tick rail.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
