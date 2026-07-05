import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-vignette",
  title: "Vignette · noir",
  group: "Effects",
  description:
    "A film title card: Ken Burns drift while the vignette iris tightens into a spotlight as the title lands.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
