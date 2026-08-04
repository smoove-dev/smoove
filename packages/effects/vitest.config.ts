import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // No skia setup file: these tests are array and string math. The
    // canvas-touching coverage lives in @smoove/core (the pipeline) and
    // @smoove/renderer (the real WebGL1 compile).
    environment: "node",
  },
});
