import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDetached, listFiles, PRESET_DIR, PresetError, templateDir } from "./app.js";

/** What `smoove studio detach` will do to a project. */
export interface DetachPlan {
  /** Project-relative paths it writes. */
  write: string[];
  /** The package.json scripts it sets. */
  scripts: Record<string, string>;
}

/** Where the detached app lives in the project. */
export const APP_DIR = "studio";

const SCRIPTS = {
  dev: "react-router dev",
  build: "react-router build",
  start: "react-router-serve ./build/server/index.js",
  test: "vitest run",
  typecheck: "react-router typegen && tsc",
};

/** The files and scripts a detach writes, without writing anything. */
export function planDetach(root: string): DetachPlan {
  const template = templateDir();
  const app = listFiles(join(template, "app")).map((f) => `${APP_DIR}/${f}`);
  const configs = listFiles(join(template, "detached"));
  if (!existsSync(join(root, "package.json"))) {
    throw new PresetError("There's no package.json here, so this isn't a smoove project.");
  }
  return { write: [...app, ...configs].sort(), scripts: { ...SCRIPTS } };
}

/**
 * Hand the studio app over to the project, for good: write it into `studio/`
 * with its Vite, React Router, Vitest and TypeScript configs, and point the
 * package.json scripts at them. `compositions/` and `smoove.config.ts` stay as
 * they are, and the app keeps reading both.
 */
export function detach(root: string): DetachPlan {
  if (isDetached(root)) throw new PresetError("This project is already detached.");
  if (existsSync(join(root, APP_DIR))) {
    throw new PresetError(
      `There's already a ${APP_DIR}/ folder here. Move it out of the way, then detach again.`,
    );
  }
  const plan = planDetach(root);
  const template = templateDir();
  cpSync(join(template, "app"), join(root, APP_DIR), { recursive: true });
  for (const file of listFiles(join(template, "detached"))) {
    writeFileSync(join(root, file), readFileSync(join(template, "detached", file)));
  }

  const pkgFile = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8")) as { scripts?: Record<string, string> };
  pkg.scripts = { ...pkg.scripts, ...plan.scripts };
  writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

  rmSync(join(root, PRESET_DIR), { recursive: true, force: true });
  return plan;
}
