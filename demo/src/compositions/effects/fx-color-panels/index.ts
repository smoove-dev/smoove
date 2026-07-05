import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-color-panels",
  title: "Color panels · keynote",
  group: "Effects",
  description:
    "A conference title slide: translucent blades pendulum on two axes and stretch behind the lockup.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
