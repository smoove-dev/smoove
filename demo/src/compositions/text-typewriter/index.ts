import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "text-typewriter",
  title: "Typewriter text",
  group: "Text",
  description:
    "Word- and letter-mode typewriter reveals inside flex bubbles that reserve their final height up front.",
  tags: ["text", "typewriter", "cursor"],
  composition: () => import("./composition.js"),
};

export default entry;
