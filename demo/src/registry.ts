import { defineRegistry } from "@konva-motion/studio";
import cohabit from "./compositions/cohabit/index.js";
import pulse from "./compositions/pulse/index.js";
import ribbon from "./compositions/ribbon/index.js";

/**
 * demo2's registry. Each demo lives in its own directory — `schema.ts`,
 * `composition.ts` (default-exports the `Composition`), and `index.ts` (default-
 * exports the `RegistryEntry`). The `@konva-motion/vite` plugin wires HMR for
 * each entry automatically; nothing else to do.
 */
export default defineRegistry([pulse, ribbon, cohabit]);
