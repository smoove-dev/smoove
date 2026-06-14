import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "flex-typewriter",
  title: "Typewriter pushes image",
  group: "Text",
  description:
    "An image glued to the bottom of a typing block slides down as new lines appear — no manual height math.",
  tags: ["text", "flex", "reflow"],
  composition: () => import("./composition.js"),
};

export default entry;
