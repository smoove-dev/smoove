import type { RegistryEntry } from "@konva-motion/studio";

const entry: RegistryEntry = {
  id: "custom-font",
  title: "Custom font",
  group: "Text",
  description:
    "A declarative Font (family + faces) loaded from ?url imports, with face selection (regular / bold / italic). The composition buffers the font before playback so there's no fallback-glyph flash.",
  tags: ["text", "font", "buffer"],
  composition: () => import("./composition.js"),
};

export default entry;
