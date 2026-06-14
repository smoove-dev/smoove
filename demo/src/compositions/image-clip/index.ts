import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "image-clip",
  title: "Circular clip reveal",
  group: "Images",
  description:
    "Each photo is revealed through an expanding circular clip mask, then handed off to the next.",
  tags: ["image", "clip", "reveal"],
  composition: () => import("./composition.js"),
};

export default entry;
