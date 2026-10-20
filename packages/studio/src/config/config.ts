import { existsSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";

export { defineConfig, type StudioConfig } from "./define.js";

/** `smoove.config.ts` after checking, with every option filled in. Node only. */
export interface ResolvedStudioConfig {
  name: string | null;
  /** Absolute path of the logo image. */
  logo: string | null;
  primaryColor: string | null;
  render: boolean;
}

/** A `smoove.config.ts` the studio can't use. The message names the key. */
export class StudioConfigError extends Error {}

const KEYS = ["name", "logo", "primaryColor", "render"] as const;
const LOGO_EXTENSIONS = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);

function text(key: string, value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new StudioConfigError(`"${key}" in smoove.config.ts must be a non-empty string.`);
  }
  return value;
}

/**
 * Check a `smoove.config.ts` default export and fill in the defaults. `configDir`
 * is the folder the config file is in; the logo path resolves against it.
 */
export function resolveStudioConfig(raw: unknown, configDir: string): ResolvedStudioConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new StudioConfigError(
      "smoove.config.ts must export an object: export default defineConfig({}).",
    );
  }
  const config = raw as Record<string, unknown>;
  for (const key of Object.keys(config)) {
    if (!(KEYS as readonly string[]).includes(key)) {
      throw new StudioConfigError(
        `smoove.config.ts has an unknown option "${key}". The options are ${KEYS.join(", ")}.`,
      );
    }
  }

  let logo: string | null = null;
  if (config.logo !== undefined) {
    const given = text("logo", config.logo);
    logo = resolve(configDir, given);
    if (!existsSync(logo) || !statSync(logo).isFile()) {
      throw new StudioConfigError(
        `"logo" in smoove.config.ts points at ${given}, which isn't there.`,
      );
    }
    if (!LOGO_EXTENSIONS.has(extname(logo).toLowerCase())) {
      throw new StudioConfigError(
        `"logo" in smoove.config.ts must be an svg, png, jpg or webp image, not ${given}.`,
      );
    }
  }
  if (config.render !== undefined && typeof config.render !== "boolean") {
    throw new StudioConfigError(`"render" in smoove.config.ts must be true or false.`);
  }
  return {
    name: config.name === undefined ? null : text("name", config.name),
    logo,
    primaryColor:
      config.primaryColor === undefined ? null : text("primaryColor", config.primaryColor),
    render: config.render !== false,
  };
}
