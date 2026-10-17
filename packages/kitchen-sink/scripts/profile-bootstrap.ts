// Bootstrap that runs INSIDE Vite's module graph so there is exactly one
// @smoove/core instance (see the headless-comp-verify-recipe notes).
import { setupServerRendering } from "@smoove/renderer";
// biome-ignore lint/style/useNodejsImportProtocol: bare "module" matches the renderer's own import.
import { createRequire } from "module";
import "@smoove/renderer/gl";
import registry from "../src/registry.js";

/** Counters for GL object churn, installed on every context headless-gl hands out. */
export const glStats: Record<string, number> = {
  contexts: 0,
  createTexture: 0,
  deleteTexture: 0,
  createFramebuffer: 0,
  deleteFramebuffer: 0,
  createProgram: 0,
  deleteProgram: 0,
  createShader: 0,
  deleteShader: 0,
  createBuffer: 0,
  deleteBuffer: 0,
  texImage2D: 0,
  readPixels: 0,
};

export let glPatched = false;

function instrument(gl: Record<string, unknown>): void {
  glStats.contexts++;
  for (const name of Object.keys(glStats)) {
    if (name === "contexts") continue;
    const orig = gl[name] as ((...a: unknown[]) => unknown) | undefined;
    if (typeof orig !== "function") continue;
    gl[name] = (...args: unknown[]) => {
      glStats[name]++;
      return orig.apply(gl, args);
    };
  }
}

// Wrap the headless-gl factory in the require cache BEFORE the renderer's
// gl-node.ts pulls it, so every context it creates is counted.
try {
  // Resolve `gl` the way the renderer does — it's an optional dep of
  // @smoove/renderer, so it isn't reachable from kitchen-sink's node_modules.
  const req = createRequire(new URL("../../renderer/src/gl-node.ts", import.meta.url));
  const id = req.resolve("gl");
  const orig = req("gl") as (...a: unknown[]) => Record<string, unknown> | null;
  const wrapped = (...args: unknown[]) => {
    const ctx = orig(...args);
    if (ctx) instrument(ctx);
    return ctx;
  };
  const entry = (req as unknown as { cache: Record<string, { exports: unknown }> }).cache[id];
  if (entry) {
    entry.exports = wrapped;
    glPatched = true;
  }
} catch (err) {
  console.warn("[profile] could not patch headless-gl:", (err as Error).message);
}

setupServerRendering();

export async function load(id: string) {
  return registry.load(id);
}
