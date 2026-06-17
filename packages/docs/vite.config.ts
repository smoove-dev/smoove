import { konvaMotion } from "@konva-motion/vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import { type Plugin, defineConfig } from "vite";

export default defineConfig({
  plugins: [
    mdx(),
    tailwindcss(),
    // `@konva-motion/vite` emits its `Plugin` type against its own pinned Vite 6
    // (devDep); this package runs on Vite 7. The two `Plugin` types differ only
    // cosmetically (a `HotUpdateOptions` field), so the runtime plugin is fine —
    // cast past the structural d.ts mismatch.
    konvaMotion() as unknown as Plugin,
    reactRouter(),
  ],
  server: { port: 5176 },
  build: { target: "esnext" },
resolve: {
tsconfigPaths: true
},
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react-router", "react-router/dom"],
    esbuildOptions: { target: "esnext" },
  },
});
