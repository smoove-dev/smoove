import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "audiogram",
  title: "Audiogram",
  group: "Media",
  description:
    "A podcast-clip card: static waveform with a played-portion fill, and a speaking ring that breathes with the voice's real loudness and stills in the pauses.",
  tags: ["audio", "introspection", "waveform", "podcast"],
  composition: () => import("./composition.js"),
};

export default entry;
