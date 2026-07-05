import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-dithering",
  title: "Dithering · SPHERE.EXE",
  group: "Effects",
  description:
    "A 1-bit renderer boots: the spinning sphere steps through random, 2×2, 4×4 and 8×8 ordered matrices.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
