import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "eq-spectrum",
  title: "EQ spectrum",
  group: "Media",
  description:
    "A full-stage mirrored equalizer: 48 log-spaced bands from bandsAt, frame-pure peak caps, and a bass-driven glow — all real sound.",
  tags: ["audio", "introspection", "eq", "spectrum"],
  composition: () => import("./composition.js"),
};

export default entry;
