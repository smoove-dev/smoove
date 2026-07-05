import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-pulsing-border",
  title: "Pulsing border · listening",
  group: "Effects",
  description:
    "A voice assistant's ambient frame: calm when idle, blooming and smoking while it listens.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
