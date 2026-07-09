import type { RegistryEntry } from "@smoove/studio";
import { type PlaygroundProps, schema } from "./schema.js";

const entry: RegistryEntry<PlaygroundProps> = {
  id: "shapes-playground",
  title: "Flex resize playground",
  group: "Layout",
  description:
    "Resize Box A and Box B from the inspector and watch the siblings reflow — the elastic Box C grows to fill the leftover space, and once the boxes overflow the frame they all shrink. Tweak gap, padding, justify, and align too.",
  tags: ["flex", "shapes", "props", "resize"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
