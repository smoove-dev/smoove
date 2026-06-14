import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "journey",
  title: "A Traveler's Journey",
  group: "Layout",
  description:
    "A four-chapter cinematic sequence with polaroids, letterboxing and timecode — the showpiece composition.",
  tags: ["cinematic", "chapters"],
  composition: () => import("./composition.js"),
};

export default entry;
