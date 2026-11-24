import { reactRouter } from "@react-router/dev/vite";
import { smoove } from "@smoove/vite";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import { defineConfig, type Plugin } from "vite";

export default defineConfig({
  plugins: [
    mdx(),
    tailwindcss(),
    // `@smoove/vite` emits its `Plugin` type against its own pinned Vite 6
    // (devDep); this package runs on Vite 7. The two `Plugin` types differ only
    // cosmetically (a `HotUpdateOptions` field), so the runtime plugin is fine —
    // cast past the structural d.ts mismatch.
    // Demo media (video, audio, images) is written to build/client/assets. In
    // CI, MEDIA_BASE_URL points the demos at the R2 bucket those files are
    // uploaded to; unset (local builds), they load from the site itself.
    smoove({ compAssetBase: process.env.MEDIA_BASE_URL || undefined }) as unknown as Plugin,
    reactRouter(),
  ],
  // Default dev port is 5176; honor an externally assigned PORT (e.g. from a
  // preview harness) so a second dev server can run alongside it.
  server: { port: Number(process.env.PORT) || 5176 },
  build: { target: "esnext" },
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react-router", "react-router/dom"],
    esbuildOptions: { target: "esnext" },
  },
});
