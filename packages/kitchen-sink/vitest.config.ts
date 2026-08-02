import { smoove } from "@smoove/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The smoove plugin rewrites media imports so they resolve in Node too,
  // which is what lets a composition module import assets under vitest.
  plugins: [smoove()],
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
  },
});
