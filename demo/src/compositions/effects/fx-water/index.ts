import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-water",
  title: "Water · the pool",
  group: "Effects",
  description:
    "Tiles seen through a meter of water: WaterEffect refracts the whole floor, caustics sharpen with the sun, a breeze crosses mid-loop.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
