import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "tickable-mark",
  title: "Tickable mark",
  group: "Components",
  description:
    "The smoove logo icon as a shareable Clip component — a function returning a Clip, size-computed geometry, fps-independent timing via info.time.",
  tags: ["components", "clip", "logo"],
  composition: () => import("./composition.js"),
};

export default entry;
