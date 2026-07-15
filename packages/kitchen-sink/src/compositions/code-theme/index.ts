import type { RegistryEntry } from "@smoove/studio";

const entry: RegistryEntry = {
  id: "code-theme",
  title: "Code theme preset",
  group: "Text",
  description:
    "Theme the highlighter with a preset (dracula) by passing it as the second argument to LezerHighlighter.",
  tags: ["code", "theme"],
  composition: () => import("./composition.js"),
};

export default entry;
