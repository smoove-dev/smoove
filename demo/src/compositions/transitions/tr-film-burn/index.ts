import type { RegistryEntry } from "@konva-motion/studio";
import { type FilmBurnProps, schema } from "./schema.js";

const entry: RegistryEntry<FilmBurnProps> = {
  id: "tr-film-burn",
  title: "Film burn · shader",
  group: "Transitions",
  description: "Fiery film-burn dissolve.",
  tags: ["transition", "shader"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
