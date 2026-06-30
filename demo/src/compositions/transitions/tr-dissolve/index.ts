import type { RegistryEntry } from "@smoove/studio";
import { type DissolveProps, schema } from "./schema.js";

const entry: RegistryEntry<DissolveProps> = {
  id: "tr-dissolve",
  title: "Dissolve · shader",
  group: "Transitions",
  description: "Burning dissolve with a glowing edge.",
  tags: ["transition", "shader"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
