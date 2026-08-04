import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "blur",
  title: "Blur",
  group: "Effects",
  description:
    "A rack focus over real footage: the plate defocuses through a six-blade lens while the title resolves out of a gaussian blur, then the move runs backwards.",
  tags: ["effects", "shader", "focus", "bokeh", "video"],
  composition: () => import("./composition.js"),
};

export default entry;
