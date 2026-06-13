import type { RegistryEntry } from "@konva-motion/studio";
import { type RibbonProps, schema } from "./schema.js";

const entry: RegistryEntry<RibbonProps> = {
  id: "ribbon",
  title: "Ribbon",
  group: "Text",
  description:
    "Sweeping color ribbons behind an animated headline, with badges. Exercises every props-form field type.",
  tags: ["text", "layout", "props"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
