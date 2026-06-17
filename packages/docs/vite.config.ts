import { konvaMotion } from "@konva-motion/vite";
import { reactRouter } from "@react-router/dev/vite";
import { type Plugin, defineConfig } from "vite";

const shim = new URL("./src/node-module-shim.ts", import.meta.url).pathname;

/**
 * Demo compositions live in their own modules and are handed to `<km-player>` as
 * a URL via `?url` (see `src/demos/registry.ts`), so the player dynamically
 * `import()`s them at runtime — our showcase of remote-file loading.
 *
 * Vite's stock `?url` works in dev (the dev server transforms modules on fetch)
 * but in a production build it emits the *raw, untransformed* source as an
 * asset, whose bare `@konva-motion/core` / `konva` imports can't resolve when
 * the browser imports it. So for `src/demos/*.ts?url` in the client build we
 * emit a real, bundled chunk instead and hand back its URL — the same trick
 * Vite's `?worker&url` uses. In dev (and the SSR pass) we no-op and let Vite's
 * built-in `?url` handle it.
 */
function demoModuleUrls(): Plugin {
  const MATCH = /[/\\]demos[/\\][^?]+\.ts\?url$/;
  let bundleAsChunk = false;
  return {
    name: "km-demo-module-urls",
    enforce: "pre",
    configResolved(config) {
      bundleAsChunk = config.command === "build" && !config.build.ssr;
    },
    load(id) {
      if (!bundleAsChunk || !MATCH.test(id)) return null;
      const ref = this.emitFile({ type: "chunk", id: id.slice(0, -"?url".length) });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
  };
}

export default defineConfig({
  plugins: [demoModuleUrls(), konvaMotion(), reactRouter()],
  server: { port: 5176 },
  build: { target: "esnext" },
  resolve: {
    // single React instance across the workspace-linked player + its deps.
    dedupe: ["react", "react-dom"],
    alias: [{ find: /^node:module$/, replacement: shim }],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react-router", "react-router/dom"],
    esbuildOptions: { target: "esnext" },
  },
});
