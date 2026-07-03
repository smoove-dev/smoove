import { defineConfig } from "vite";

// `node:module` can't exist in the browser; flexily (a @smoove/core dependency)
// reaches for its `createRequire` at module eval, so stub it.
const shim = new URL("./src/node-module-shim.ts", import.meta.url).pathname;

export default defineConfig({
  build: { target: "esnext" },
  resolve: {
    alias: [{ find: /^node:module$/, replacement: shim }],
  },
});
