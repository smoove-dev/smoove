import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-blur",
  title: "Blur · rack focus",
  group: "Effects",
  description:
    "A lens pulls focus between a title and a field of bokeh — two BlurEffect planes with inverse radii.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
