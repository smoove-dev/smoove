import type { RegistryEntry } from "@smoove/studio";
import { type DreamyZoomProps, schema } from "./schema.js";

const entry: RegistryEntry<DreamyZoomProps> = {
  id: "tr-dreamy-zoom",
  title: "Dreamy zoom · shader",
  group: "Transitions",
  description: "Spiralling zoom blend.",
  tags: ["transition", "shader"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
