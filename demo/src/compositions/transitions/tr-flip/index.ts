import type { RegistryEntry } from "@smoove/studio";
import { type FlipProps, schema } from "./schema.js";

const entry: RegistryEntry<FlipProps> = {
  id: "tr-flip",
  title: "Flip",
  group: "Transitions",
  description: "Fake-3D card flip via scaleX/scaleY (Konva has no real 3D).",
  tags: ["transition", "geometric"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
