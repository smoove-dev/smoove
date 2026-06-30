import { smoove } from "@smoove/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const shim = new URL("./src/node-module-shim.ts", import.meta.url).pathname;

export default defineConfig({
  plugins: [smoove(), reactRouter()],
  server: { port: 5174 },
  build: { target: "esnext" },
  ssr: {
    // Keep the headless renderer's native deps external in the SSR build —
    // they're loaded with Node's `require` at runtime. Bundling them makes
    // Rollup try to parse the prebuilt `.node` binaries (skia-canvas's
    // `skia.node`, headless-gl's `webgl.node`, @mediabunny/server's node-av
    // bindings) as JS and the build fails.
    external: ["skia-canvas", "gl", "mediabunny", "@mediabunny/server"],
  },
  resolve: {
    // single React instance across demo2 + the workspace-linked studio package
    // + Base UI (avoids "Invalid hook call" / null-React).
    dedupe: ["react", "react-dom"],
    // `node:module` can't exist in the browser; stub it in the CLIENT bundle.
    // This matches only `node:module` (not bare `module` or other `node:*`), so
    // the SSR renderer's `createRequire` (imported from `"module"`) is untouched
    // and shader transitions still render server-side.
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
