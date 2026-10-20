import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Where the hidden studio app lives in a preset project. Generated, gitignored. */
export const PRESET_DIR = ".smoove/studio";

/** The studio port, unless `--port` says otherwise. */
export const DEFAULT_PORT = 5174;

/** A refusal the command line prints as is: no stack, exit 1. */
export class PresetError extends Error {}

/** The template shipped in this package: `app/` and the detached configs. */
export function templateDir(): string {
  return fileURLToPath(new URL("../../template", import.meta.url));
}

/** A project is detached once it owns its app, which means it has a React Router config. */
export function isDetached(root: string): boolean {
  return ["ts", "js", "mjs"].some((ext) => existsSync(join(root, `react-router.config.${ext}`)));
}

export function listFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const path = join(dir, d.name);
    return d.isDirectory() ? listFiles(path, base) : [relative(base, path).split(sep).join("/")];
  });
}

const GENERATED_NOTE =
  "// Written by smoove on every start. Don't edit it: change smoove.config.ts,\n// or run `smoove studio detach` to own the studio app.\n";

function viteConfig(root: string): string {
  return `${GENERATED_NOTE}import { reactRouter } from "@react-router/dev/vite";
import { smooveStudio } from "@smoove/studio/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [smooveStudio({ root: ${JSON.stringify(root)} }), reactRouter()],
  server: { port: ${DEFAULT_PORT} },
});
`;
}

function reactRouterConfig(root: string): string {
  return `${GENERATED_NOTE}import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "app",
  ssr: true,
  buildDirectory: ${JSON.stringify(join(root, "build"))},
} satisfies Config;
`;
}

/**
 * Mirror the studio app into `<root>/.smoove/studio/`, with a Vite and a React
 * Router config pointing at the project. Only files whose bytes differ are
 * written, so an unchanged app doesn't set off the file watcher, and files the
 * template no longer has are removed.
 */
export function syncPresetApp(root: string): { dir: string; written: string[]; removed: string[] } {
  const dir = join(root, PRESET_DIR);
  const source = join(templateDir(), "app");
  const want = new Map<string, string | Buffer>();
  for (const file of listFiles(source)) want.set(`app/${file}`, readFileSync(join(source, file)));
  want.set("vite.config.ts", viteConfig(root));
  want.set("react-router.config.ts", reactRouterConfig(root));

  const written: string[] = [];
  for (const [file, body] of want) {
    const target = join(dir, file);
    const bytes = typeof body === "string" ? Buffer.from(body) : body;
    if (existsSync(target) && readFileSync(target).equals(bytes)) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    written.push(file);
  }

  const removed: string[] = [];
  for (const file of listFiles(join(dir, "app"))) {
    if (want.has(`app/${file}`)) continue;
    rmSync(join(dir, "app", file));
    removed.push(`app/${file}`);
  }
  removeEmptyDirs(join(dir, "app"));
  return { dir, written, removed };
}

function removeEmptyDirs(dir: string): void {
  if (!existsSync(dir)) return;
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) removeEmptyDirs(join(dir, d.name));
  }
  if (readdirSync(dir).length === 0) rmdirSync(dir);
}
