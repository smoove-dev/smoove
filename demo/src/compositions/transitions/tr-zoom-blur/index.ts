import type { RegistryEntry } from "@konva-motion/studio";
import { type ZoomBlurProps, schema } from "./schema.js";

const entry: RegistryEntry<ZoomBlurProps> = {
  id: "tr-zoom-blur",
  title: "Zoom blur · shader",
  group: "Transitions",
  description: "Counter-rotating radial zoom blur.",
  tags: ["transition", "shader"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
