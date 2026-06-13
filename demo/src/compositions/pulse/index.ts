import type { RegistryEntry } from "@konva-motion/studio";
import { type PulseProps, schema } from "./schema.js";

const entry: RegistryEntry<PulseProps> = {
  id: "pulse",
  title: "Pulse",
  description:
    "A row of circles pulsing on a sine wave — edit the props to see the preview react live.",
  tags: ["motion", "loop", "props"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
