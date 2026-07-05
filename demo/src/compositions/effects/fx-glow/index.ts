import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-glow",
  title: "Glow · neon sign",
  group: "Effects",
  description:
    "A tired neon sign at night: two GlowEffect tubes breathing, buzzing and browning out on a deterministic flicker.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
