import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // `typecheck` spawns a real tsc; the first run pays for loading @smoove/core's d.ts.
    testTimeout: 60_000,
  },
});
