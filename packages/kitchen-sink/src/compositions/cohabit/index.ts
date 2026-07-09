import type { RegistryEntry } from "@smoove/studio";
import { type CohabitProps, schema } from "./schema.js";

const entry: RegistryEntry<CohabitProps> = {
  id: "cohabit",
  title: "Cohabit",
  group: "Film",
  description:
    "A four-scene branded promo — graded video, a layered music + voiceover + SFX mix, and a prop-driven end card.",
  tags: ["film", "video", "audio", "brand"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
