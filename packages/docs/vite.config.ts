import { konvaMotion } from "@konva-motion/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const shim = new URL("./src/node-module-shim.ts", import.meta.url).pathname;

export default defineConfig({
  plugins: [konvaMotion(), reactRouter()],
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
