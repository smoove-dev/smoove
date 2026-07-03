import { defineRegistry } from "@smoove/studio";
import helloSmoove from "./compositions/hello-smoove/index.js";

/**
 * Every composition in the studio is one registry entry. Add a folder under
 * src/compositions/, export a RegistryEntry from its index.ts, and list it
 * here — the sidebar, stage, and server renderer all read from this file.
 */
export default defineRegistry([helloSmoove]);
