import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "audio-visuals",
  title: "Audio visuals",
  group: "Media",
  description:
    "EQ bars, a waveform outline, a VU meter with peak hold, and a beat pulse — all driven by the clip's real decoded sound via introspect.",
  tags: ["audio", "introspection", "eq", "waveform", "beat"],
  composition: () => import("./composition.js"),
};

export default entry;
