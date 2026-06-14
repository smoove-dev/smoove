import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "image-slider",
  title: "Slider",
  group: "Images",
  description: "A four-image carousel with slide-in / slide-out transitions and progress dots.",
  tags: ["image", "carousel", "slide"],
  composition: () => import("./composition.js"),
};

export default entry;
