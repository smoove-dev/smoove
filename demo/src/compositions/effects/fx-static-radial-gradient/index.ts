import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-static-radial-gradient",
  title: "Static radial gradient · eclipse",
  group: "Effects",
  description:
    "Totality in eight seconds: the focal point orbits 360° behind a black moon while the falloff tightens.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
