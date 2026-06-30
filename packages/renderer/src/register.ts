// Side-effecting sugar: `import "@smoove/renderer/register"` ===
// calling setupServerRendering() at import time. Import this before constructing
// any Composition.
import { setupServerRendering } from "./setup.js";

setupServerRendering();
