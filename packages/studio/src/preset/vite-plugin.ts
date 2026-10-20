import { existsSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { smoove } from "@smoove/vite";
import { type Plugin, searchForWorkspaceRoot, type ViteDevServer } from "vite";
import { discoverCompositions, registryModuleCode } from "./discovery.js";
import { CONFIG_FILES, loadStudioConfig } from "./load-config.js";

export interface SmooveStudioOptions {
  /** The project root: where `compositions/` and `smoove.config.ts` live. Default: Vite's root. */
  root?: string;
  /** The studio app folder, for the dependency scan. Default: `app` under Vite's root. */
  appDir?: string;
  /** Mount the agent bridge (see `@smoove/vite`). Default `true`. */
  agent?: boolean;
}

const REGISTRY_ID = "virtual:smoove/registry.ts";
const CONFIG_ID = "virtual:smoove/config";

/** React and the studio's Base UI, pre-bundled with the app's single React (else "Invalid hook call"). */
const OPTIMIZE = [
  "@smoove/core",
  "konva",
  "react",
  "react-dom",
  "react-dom/client",
  "react-router",
  "react-router/dom",
  // Base UI is the studio's dependency, not the project's: under pnpm the
  // project can't resolve it by name, so name it through the studio.
  ...[
    "tooltip",
    "toast",
    "menu",
    "dialog",
    "tabs",
    "slider",
    "switch",
    "select",
    "number-field",
  ].map((part) => `@smoove/studio > @base-ui/react/${part}`),
];

/** The `node:module` stub for the browser bundle (built `.js`, or `.ts` when run from source). */
function nodeModuleShim(): string {
  const js = fileURLToPath(new URL("./node-module-shim.js", import.meta.url));
  return existsSync(js) ? js : js.replace(/\.js$/, ".ts");
}

/**
 * The smoove studio under Vite: finds the compositions, serves the project's
 * `smoove.config.ts`, and carries the settings the studio app needs. The
 * hidden preset and a detached project both use it.
 *
 * It serves two modules to the app: `virtual:smoove/registry.ts` (one entry
 * per `compositions/<folder>/index.ts`) and `virtual:smoove/config`.
 */
export function smooveStudio(options: SmooveStudioOptions = {}): Plugin[] {
  let root = options.root ?? process.cwd();
  let compositions = join(root, "compositions");

  const studio: Plugin = {
    name: "smoove-studio",
    enforce: "pre",
    config(config) {
      const viteRoot = config.root ?? process.cwd();
      root = options.root ?? viteRoot;
      compositions = join(root, "compositions");
      const appDir = options.appDir ?? join(viteRoot, "app");
      return {
        build: { target: "esnext" },
        // The compositions sit outside Vite's root. Naming fs.allow turns off
        // Vite's own workspace-root allowance, so keep that one too.
        server: { fs: { allow: [root, searchForWorkspaceRoot(root)] } },
        ssr: {
          // Native modules the headless renderer loads with Node's require at
          // runtime; bundling them makes Rollup parse `.node` binaries as JS.
          external: ["skia-canvas", "gl", "mediabunny", "@mediabunny/server"],
        },
        resolve: {
          dedupe: ["react", "react-dom"],
          // `node:module` can't exist in the browser. Only the exact id, so the
          // SSR renderer's `createRequire` (from "module") is untouched.
          alias: [{ find: /^node:module$/, replacement: nodeModuleShim() }],
        },
        optimizeDeps: {
          // The compositions sit outside Vite's root, so name them for the scan;
          // otherwise core and konva get pre-bundled late as a second copy.
          entries: [
            `${appDir}/**/*.{ts,tsx}`,
            `${compositions}/*/index.{ts,js}`,
            `${compositions}/**/composition.{ts,js}`,
          ],
          include: OPTIMIZE,
        },
      };
    },
    resolveId(id) {
      if (id === REGISTRY_ID || id === CONFIG_ID) return `\0${id}`;
      return null;
    },
    async load(id) {
      if (id === `\0${REGISTRY_ID}`) return registryModuleCode(discoverCompositions(compositions));
      if (id === `\0${CONFIG_ID}`) {
        const config = await loadStudioConfig(root);
        const logo = config.logo ? `import logoUrl from ${JSON.stringify(config.logo)};\n` : "";
        const value = `{ name: ${JSON.stringify(config.name)}, logoUrl: ${config.logo ? "logoUrl" : "null"}, primaryColor: ${JSON.stringify(config.primaryColor)}, render: ${config.render} }`;
        return `${logo}export default ${value};\n`;
      }
      return null;
    },
    configureServer(server) {
      server.watcher.add([compositions, ...CONFIG_FILES.map((f) => join(root, f))]);
      const onTree = (file: string): void => {
        if (touchesCatalog(compositions, file)) reloadRegistry(server);
      };
      const onConfig = (file: string): void => {
        if (dirname(file) === root && CONFIG_FILES.includes(basename(file))) void server.restart();
      };
      for (const event of ["add", "unlink", "addDir", "unlinkDir"] as const) {
        server.watcher.on(event, onTree);
        server.watcher.on(event, onConfig);
      }
      server.watcher.on("change", onConfig);
    },
  };

  return [smoove({ root: options.root, agent: options.agent }) as unknown as Plugin, studio];
}

/** A folder right under `compositions/`, or an index file right inside one. */
function touchesCatalog(compositions: string, file: string): boolean {
  const rel = relative(compositions, file);
  if (rel === "" || rel.startsWith("..")) return false;
  const parts = rel.split(sep);
  if (parts.length === 1) return true;
  return parts.length === 2 && /^index\.(?:ts|js)$/.test(parts[1] ?? "");
}

/** Drop the generated registry everywhere it's cached, and reload the page. */
function reloadRegistry(server: ViteDevServer): void {
  for (const env of Object.values(server.environments)) {
    const mod = env.moduleGraph.getModuleById(`\0${REGISTRY_ID}`);
    if (mod) env.moduleGraph.invalidateModule(mod);
  }
  server.ws.send({ type: "full-reload" });
}
