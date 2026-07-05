import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-heatmap",
  title: "Heatmap · thermal cam",
  group: "Effects",
  description:
    "A FLIR camera feed: iron color ramp, sweeping scan line, isotherm contour mode and a drifting core-temperature HUD.",
  tags: ["effect", "filter"],
  composition: () => import("./composition.js"),
};

export default entry;
