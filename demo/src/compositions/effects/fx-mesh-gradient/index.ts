import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "fx-mesh-gradient",
  title: "Mesh gradient · hero",
  group: "Effects",
  description:
    "The landing page every gradient dreams of: a living MeshGradient backdrop that leans in as the CTA lands.",
  tags: ["effect", "source", "shader"],
  composition: () => import("./composition.js"),
};

export default entry;
