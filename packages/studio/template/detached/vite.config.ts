import { reactRouter } from "@react-router/dev/vite";
import { smooveStudio } from "@smoove/studio/vite";
import { defineConfig } from "vite";

// smooveStudio() finds the compositions, serves smoove.config.ts, and carries
// the settings the studio app needs (React dedupe, pre-bundling, the SSR
// externals for the renderer's native modules).
export default defineConfig({
  plugins: [smooveStudio({ appDir: "studio" }), reactRouter()],
  server: { port: 5174 },
});
