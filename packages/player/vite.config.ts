import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// Browser stub for `node:module` — flexily's logger detection reaches for
// `createRequire`, which can't exist in the standalone (browser) bundle.
const nodeModuleShim = fileURLToPath(new URL("./src/node-module-shim.ts", import.meta.url));

/**
 * Two builds from one config, selected by `--mode`:
 *
 * - default mode → **ESM** (`dist/player.js`) for npm/bundler consumers.
 *   konva / core / lit stay *external* so apps don't double-bundle them.
 *   Declarations are emitted here via vite-plugin-dts.
 * - `--mode standalone` → self-contained **ESM** (`dist/player.global.js`) for
 *   a `<script type="module">` tag. Everything is bundled (konva, core,
 *   flexily, lit) and the entry also pins `window.KonvaMotion` (core) +
 *   `window.Konva`. (Classic-IIFE output isn't possible — flexily uses
 *   top-level await, which only an ES module can carry.)
 *
 * Both extract `dist/player.css` (for `<link>` / `?styles.css` import).
 */

/** Peers/deps kept external in the ESM build. */
function isExternal(id: string): boolean {
  return (
    id === "konva" ||
    id === "@konva-motion/core" ||
    id === "lit" ||
    id.startsWith("lit/") ||
    id.startsWith("lit-") ||
    id.startsWith("@lit/")
  );
}

export default defineConfig(({ mode }) => {
  const standalone = mode === "standalone";

  return {
    resolve: standalone
      ? { alias: [{ find: /^node:module$/, replacement: nodeModuleShim }] }
      : undefined,
    build: {
      target: "es2022",
      sourcemap: true,
      // The standalone pass runs second; don't wipe the ESM output + types.
      emptyOutDir: !standalone,
      minify: standalone ? "esbuild" : false,
      cssMinify: true,
      lib: {
        entry: standalone ? "src/standalone.ts" : "src/index.ts",
        formats: ["es"],
        fileName: () => (standalone ? "player.global.js" : "player.js"),
        cssFileName: "player",
      },
      // The standalone build must be a single file (flexily uses dynamic
      // imports, which would otherwise split into sibling chunks).
      rollupOptions: standalone
        ? { output: { inlineDynamicImports: true } }
        : { external: isExternal },
    },
    plugins: standalone ? [] : [dts({ include: ["src"] })],
  };
});
