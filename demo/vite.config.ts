import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const shim = new URL("./src/node-module-shim.ts", import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { target: "esnext" },
  resolve: {
    alias: [{ find: /^node:module$/, replacement: shim }],
  },
  optimizeDeps: {
    esbuildOptions: { target: "esnext" },
  },
});
