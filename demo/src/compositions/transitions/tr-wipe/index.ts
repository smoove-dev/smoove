import type { RegistryEntry } from "@konva-motion/studio";
import { type WipeProps, schema } from "./schema.js";

const entry: RegistryEntry<WipeProps> = {
  id: "tr-wipe",
  title: "Wipe",
  group: "Transitions",
  description: "Rectangular clip reveal of the incoming layer.",
  tags: ["transition", "geometric"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
