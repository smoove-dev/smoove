import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "flex-row-grow",
  title: "Row of growing images",
  group: "Layout",
  description:
    "A flex row where the active image grows and its neighbours shrink — flexGrow animated across the row.",
  tags: ["flex", "row", "grow"],
  composition: () => import("./composition.js"),
};

export default entry;
