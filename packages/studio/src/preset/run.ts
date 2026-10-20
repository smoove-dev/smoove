import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createBuilder, createServer, type ViteDevServer } from "vite";
import { PRESET_DIR, PresetError, syncPresetApp } from "./app.js";

/** Sync the hidden app, then run the studio dev server in it. Resolves once it listens. */
export async function startPreset(opts: { root: string; port?: number }): Promise<ViteDevServer> {
  const { dir } = syncPresetApp(opts.root);
  const server = await createServer({
    root: dir,
    configFile: join(dir, "vite.config.ts"),
    ...(opts.port !== undefined ? { server: { port: opts.port } } : {}),
  });
  await server.listen();
  server.printUrls();
  return server;
}

/** Sync the hidden app, then build the studio into `<root>/build`. */
export async function buildPreset(opts: { root: string }): Promise<void> {
  const { dir } = syncPresetApp(opts.root);
  const builder = await createBuilder({ root: dir, configFile: join(dir, "vite.config.ts") });
  await builder.buildApp();
}

/** The `react-router-serve` script, resolved from this package. */
function serveBin(): string {
  const require = createRequire(import.meta.url);
  const pkgFile = require.resolve("@react-router/serve/package.json");
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8")) as { bin: string | Record<string, string> };
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin["react-router-serve"];
  if (!bin) throw new PresetError("@react-router/serve has no react-router-serve script.");
  return join(dirname(pkgFile), bin);
}

/**
 * Serve the built studio. The built server finds its assets relative to the
 * folder it was built from, so it runs with `.smoove/studio/` as its working
 * directory.
 */
export function servePreset(opts: { root: string; port?: number }): ChildProcess {
  const entry = join(opts.root, "build", "server", "index.js");
  if (!existsSync(entry)) {
    throw new PresetError("There's no build yet. Run smoove build first.");
  }
  return spawn(process.execPath, [serveBin(), entry], {
    cwd: join(opts.root, PRESET_DIR),
    stdio: "inherit",
    env: { ...process.env, ...(opts.port !== undefined ? { PORT: String(opts.port) } : {}) },
  });
}
