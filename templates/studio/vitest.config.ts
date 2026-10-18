import { smoove } from "@smoove/vite";
import { defineConfig } from "vitest/config";

// Composition tests run in Node, headless. The smoove plugin resolves media
// and font imports the same way the dev server does.
export default defineConfig({
  plugins: [smoove()],
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
  },
});
