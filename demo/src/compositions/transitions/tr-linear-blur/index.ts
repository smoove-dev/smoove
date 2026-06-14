import type { RegistryEntry } from "@konva-motion/studio";
import { type LinearBlurProps, schema } from "./schema.js";

const entry: RegistryEntry<LinearBlurProps> = {
  id: "tr-linear-blur",
  title: "Linear blur · shader",
  group: "Transitions",
  description: "Directionless blur dissolve.",
  tags: ["transition", "shader"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
