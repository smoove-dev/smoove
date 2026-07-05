import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-pulse-glow",
  title: "Pulse glow · on air",
  group: "Effects",
  description:
    "A broadcast wall where ON AIR, the tally dot and REC each breathe on their own PulseGlowEffect period — the scene has no register callback at all.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
