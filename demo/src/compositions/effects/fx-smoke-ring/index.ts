import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-smoke-ring",
  title: "Smoke ring · portal",
  group: "Effects",
  description:
    "A ring of smoke holds a door open — it breathes wide for the glowing invitation, then seals shut.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
