import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** What's under a project's `compositions/` folder. Node only. */
export interface Discovered {
  /** Folders with an index file, sorted by name. */
  folders: { name: string; index: string }[];
  /** Folders without one. */
  missing: string[];
}

const INDEX_FILES = ["index.ts", "index.js"];

/**
 * Every composition folder directly under `dir`. Files and dot folders are
 * ignored; a folder counts when it has an `index.ts` (or `index.js`). A missing
 * `dir` is an empty project, not an error.
 */
export function discoverCompositions(dir: string): Discovered {
  const found: Discovered = { folders: [], missing: [] };
  if (!existsSync(dir)) return found;
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();
  for (const name of names) {
    const index = INDEX_FILES.map((f) => join(dir, name, f)).find((f) => existsSync(f));
    if (index) found.folders.push({ name, index });
    else found.missing.push(name);
  }
  return found;
}

/**
 * The registry module for a discovery: one import per folder and a literal
 * `defineRegistry([...])`, the shape the `@smoove/vite` plugin rewrites for
 * hot reload.
 */
export function registryModuleCode(found: Discovered): string {
  const imports = found.folders.map((f, i) => `import c${i} from ${JSON.stringify(f.index)};`);
  const names = found.folders.map((_, i) => `c${i}`).join(", ");
  const options = JSON.stringify({
    folders: found.folders.map((f) => f.name),
    missing: found.missing,
  });
  return [
    'import { defineRegistry } from "@smoove/studio";',
    ...imports,
    `export default defineRegistry([${names}], ${options});`,
    "",
  ].join("\n");
}
