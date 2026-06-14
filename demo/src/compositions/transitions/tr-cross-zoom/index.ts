import type { RegistryEntry } from "@konva-motion/studio";
import { type CrossZoomProps, schema } from "./schema.js";

const entry: RegistryEntry<CrossZoomProps> = {
  id: "tr-cross-zoom",
  title: "Cross zoom · shader",
  group: "Transitions",
  description: "Zoom-blur cross-dissolve.",
  tags: ["transition", "shader"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
