import type { RegistryEntry } from "@smoove/studio";
import { type SwapProps, schema } from "./schema.js";

const entry: RegistryEntry<SwapProps> = {
  id: "tr-swap",
  title: "Swap · shader",
  group: "Transitions",
  description: "Perspective card swap with floor reflection.",
  tags: ["transition", "shader"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
