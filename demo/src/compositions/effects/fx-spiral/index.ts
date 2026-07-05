import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-spiral",
  title: "Spiral · deeper",
  group: "Effects",
  description:
    "A hypnotist's wheel: strokes thicken, distortion wobbles in, and the induction words descend.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
