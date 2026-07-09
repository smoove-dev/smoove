import type { RegistryEntry } from "@smoove/studio";
import { type HelloSmooveProps, schema } from "./schema.js";

const entry: RegistryEntry<HelloSmooveProps> = {
  id: "hello-smoove",
  title: "Hello smoove",
  group: "Basics",
  description:
    "The dot blinks awake, sweeps the mark to life, and the wordmark and slogan settle in.",
  tags: ["intro", "props"],
  propsSchema: schema,
  composition: () => import("./composition.js"),
};

export default entry;
