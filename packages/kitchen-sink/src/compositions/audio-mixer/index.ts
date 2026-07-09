import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "audio-mixer",
  title: "Mixer & ducking",
  group: "Media",
  description:
    "Three tracks with ducking, crossfade and an outro fade, visualised as animated level meters.",
  tags: ["audio", "mixer", "ducking"],
  composition: () => import("./composition.js"),
};

export default entry;
