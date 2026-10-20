import { smoove } from "@smoove/vite";
import { defineConfig } from "vitest/config";

// Composition tests run in Node, headless. The smoove plugin resolves media
// and font imports the same way the dev server does, and the renderer's
// register module gives them a skia canvas and Node font and media loaders.
// A check sweep over a long composition takes a while, hence the minute.
export default defineConfig({
  plugins: [smoove()],
  test: {
    environment: "node",
    include: ["compositions/**/*.test.{ts,js}"],
    setupFiles: ["@smoove/renderer/register"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
