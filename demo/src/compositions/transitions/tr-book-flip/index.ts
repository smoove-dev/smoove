import type { RegistryEntry } from "@smoove/studio";
import { type BookFlipProps, schema } from "./schema.js";

const entry: RegistryEntry<BookFlipProps> = {
  id: "tr-book-flip",
  title: "Book flip · shader",
  group: "Transitions",
  description: "Page-turn / book flip.",
  tags: ["transition", "shader"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
