import { smoove } from "@smoove/vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import { type Plugin, defineConfig } from "vite";

// `node:module` can't exist in the browser; flexily (via core) reaches for its
// `createRequire` to detect an optional logger. Stub it in the CLIENT bundle so
// the live <smoove-player src=…> demos (which dynamically import a core-built
// composition) load. Matches only `node:module`, so SSR is untouched. Mirrors
// the `demo` package.
const nodeModuleShim = new URL("./src/node-module-shim.ts", import.meta.url).pathname;

export default defineConfig({
  plugins: [
    mdx(),
    tailwindcss(),
    // `@smoove/vite` emits its `Plugin` type against its own pinned Vite 6
    // (devDep); this package runs on Vite 7. The two `Plugin` types differ only
    // cosmetically (a `HotUpdateOptions` field), so the runtime plugin is fine —
    // cast past the structural d.ts mismatch.
    smoove() as unknown as Plugin,
    reactRouter(),
  ],
  server: { port: 5176 },
  build: { target: "esnext" },
  resolve: {
    tsconfigPaths: true,
    alias: [{ find: /^node:module$/, replacement: nodeModuleShim }],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react-router", "react-router/dom"],
    esbuildOptions: { target: "esnext" },
  },
});
