import { defineConfig } from "vite";

const shim = new URL("./src/node-module-shim.ts", import.meta.url).pathname;

export default defineConfig({
  server: { port: 5173 },
  build: { target: "esnext" },
  resolve: {
    alias: [{ find: /^node:module$/, replacement: shim }],
  },
  optimizeDeps: {
    esbuildOptions: { target: "esnext" },
  },
});
