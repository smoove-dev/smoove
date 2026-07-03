import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "hello-smoove",
  title: "Hello smoove",
  group: "Basics",
  description: "The smoove mark draws itself, then the wordmark settles in.",
  tags: ["intro"],
  composition: () => import("./composition.js"),
};

export default entry;
