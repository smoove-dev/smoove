import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "video-sync",
  title: "Playback sync",
  group: "Media",
  description:
    "Three phases — top alone, bottom alone, then both together — proving frame-accurate video sync to the timeline.",
  tags: ["video", "sync"],
  composition: () => import("./composition.js"),
};

export default entry;
