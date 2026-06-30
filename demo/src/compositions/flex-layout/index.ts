import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "flex-layout",
  title: "Auto card",
  group: "Layout",
  description:
    "A Flex card re-flows live as its width animates — text never overlaps the image because Flexily walks the tree each tick.",
  tags: ["flex", "reflow", "card"],
  composition: () => import("./composition.js"),
};

export default entry;
