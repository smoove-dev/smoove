import type { RegistryEntry } from "@smoove/studio";
import { schema, type ZoomBlurProps } from "./schema.js";

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
