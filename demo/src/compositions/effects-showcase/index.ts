import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "effects-showcase",
  title: "Effects showcase",
  group: "Effects",
  description:
    "Shader effects: MeshGradient/Waves sources, heatmap + blur + glow on nodes, chroma key, and layer-wide film grain.",
  tags: ["effects", "shader", "webgl"],
  composition: () => import("./composition.js"),
};

export default entry;
