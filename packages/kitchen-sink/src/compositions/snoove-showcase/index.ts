import type { RegistryEntry } from "@smoove/studio";
import { type SmooveShowcaseProps, schema } from "./schema";

const entry: RegistryEntry<SmooveShowcaseProps> = {
  id: "smoove-showcase",
  title: "The Smoove Showcase",
  group: "Film",
  description: "Smoove showcase",
  tags: ["stagger", "fade"],
  composition: () => import("./composition.js"),
  propsSchema: schema,
};

export default entry;
