import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "code-edit",
  title: "Code edits",
  group: "Text",
  description:
    "Target a range with interpolateEdit and replace / insert / remove instead of diffing whole strings.",
  tags: ["code", "edit"],
  composition: () => import("./composition.js"),
};

export default entry;
