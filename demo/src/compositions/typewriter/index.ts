import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "typewriter",
  title: "Typewriter — AI chat",
  group: "Text",
  description:
    "A staggered chat thread that types each message bubble out in sequence, growing the bubble as it goes.",
  tags: ["text", "chat", "stagger"],
  composition: () => import("./composition.js"),
};

export default entry;
