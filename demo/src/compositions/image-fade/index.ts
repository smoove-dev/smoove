import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "image-fade",
  title: "Crossfade",
  group: "Images",
  description: "Dissolves between four photos with a gentle Ken-Burns drift on each frame.",
  tags: ["image", "crossfade", "pan"],
  composition: () => import("./composition.js"),
};

export default entry;
