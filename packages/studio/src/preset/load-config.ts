import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { runnerImport } from "vite";
import {
  type ResolvedStudioConfig,
  resolveStudioConfig,
  StudioConfigError,
} from "../config/config.js";

/** The names `smoove.config` may have, in the order the studio looks. */
export const CONFIG_FILES = ["smoove.config.ts", "smoove.config.js", "smoove.config.mjs"];

/** The project's config file, or null when it has none. */
export function findConfigFile(root: string): string | null {
  return CONFIG_FILES.map((f) => join(root, f)).find((f) => existsSync(f)) ?? null;
}

/**
 * Load and check the project's `smoove.config.ts`. No file means the defaults.
 * A bad config rejects with a `StudioConfigError` that names the file first.
 */
export async function loadStudioConfig(root: string): Promise<ResolvedStudioConfig> {
  const file = findConfigFile(root);
  if (!file) return resolveStudioConfig({}, root);
  const { module } = await runnerImport<{ default?: unknown }>(file, {
    root,
    configFile: false,
    logLevel: "silent",
  });
  try {
    return resolveStudioConfig(module.default, dirname(file));
  } catch (err) {
    if (err instanceof StudioConfigError) {
      throw new StudioConfigError(`${file}: ${err.message}`);
    }
    throw err;
  }
}
