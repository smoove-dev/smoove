import type { RegistryEntry } from "@konva-motion/studio";
import { type RippleProps, schema } from "./schema.js";

const entry: RegistryEntry<RippleProps> = {
  id: "tr-ripple",
  title: "Ripple · shader",
  group: "Transitions",
  description: "Concentric ripple distortion.",
  tags: ["transition", "shader"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
