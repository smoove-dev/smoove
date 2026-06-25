import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "google-font",
  title: "Google font",
  group: "Text",
  description:
    "Four Google fonts (serif, sans, mono, script) pulled by subpath import from @konva-motion/google-fonts — typed Font subclasses with per-family weight/style selection, loaded from the Google Fonts CDN and buffered before play.",
  tags: ["text", "font", "google-fonts"],
  composition: () => import("./composition.js"),
};

export default entry;
