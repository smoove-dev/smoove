import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "shapes-flex",
  title: "Shapes in a flex row",
  group: "Layout",
  description:
    "Wrapped Konva shapes (Rect, Circle, Star, RegularPolygon, Ring) laid out in a flex row — origin-corrected so centered shapes align with the rect. Rotation/scale animated centrally via Sequence.register.",
  tags: ["flex", "shapes", "layout"],
  composition: () => import("./composition.js"),
};

export default entry;
