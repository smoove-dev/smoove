import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const shim = new URL("./src/node-module-shim.ts", import.meta.url).pathname;

export default defineConfig({
  plugins: [reactRouter()],
  server: { port: 5174 },
  build: { target: "esnext" },
  resolve: {
    // single React instance across demo2 + the workspace-linked studio package
    // + Base UI (avoids "Invalid hook call" / null-React).
    dedupe: ["react", "react-dom"],
    alias: [{ find: /^node:module$/, replacement: shim }],
  },
  optimizeDeps: {
    // Force-bundle Base UI (pulled in via the linked studio package) with the
    // app's single React, otherwise its deps get a separate/null React copy.
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router",
      "react-router/dom",
      "@base-ui/react/tooltip",
      "@base-ui/react/toast",
      "@base-ui/react/menu",
      "@base-ui/react/dialog",
      "@base-ui/react/tabs",
      "@base-ui/react/slider",
      "@base-ui/react/switch",
      "@base-ui/react/select",
      "@base-ui/react/number-field",
    ],
    esbuildOptions: { target: "esnext" },
  },
});
