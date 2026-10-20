import { smoove } from "@smoove/vite";
import { defineConfig } from "vitest/config";

// Composition tests run in Node, headless. The smoove plugin resolves media
// and font imports the same way the dev server does, and the renderer's
// register module gives them a skia canvas and Node font and media loaders.
export default defineConfig({
  plugins: [smoove()],
  test: {
    environment: "node",
    include: ["compositions/**/*.test.{ts,js}"],
    setupFiles: ["@smoove/renderer/register"],
  },
});
