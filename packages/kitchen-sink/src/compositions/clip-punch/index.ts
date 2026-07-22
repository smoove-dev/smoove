import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "clip-punch",
  title: "Clip punch-out",
  group: "Components",
  description:
    "The smooveMark clip's own content punches through a cover (destination-out), revealing the drifting-orb sequence stacked below.",
  tags: ["components", "clip", "mask", "punch-out"],
  composition: () => import("./composition.js"),
};

export default entry;
