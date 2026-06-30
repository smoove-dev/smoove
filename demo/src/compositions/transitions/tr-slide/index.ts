import type { RegistryEntry } from "@smoove/studio";
import { type SlideProps, schema } from "./schema.js";

const entry: RegistryEntry<SlideProps> = {
  id: "tr-slide",
  title: "Slide",
  group: "Transitions",
  description: "Incoming layer slides in; outgoing pushes out the opposite side.",
  tags: ["transition", "geometric"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
