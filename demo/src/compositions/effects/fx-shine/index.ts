import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-shine",
  title: "Shine · premiere title",
  group: "Effects",
  description:
    "A gold title card: ShineEffect sweeps a specular gloss band across the headline on its own period — no register wiring at all.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
