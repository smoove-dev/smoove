import { GlCompositor, setCompositorFactory } from "@smoove/transitions";
import { createNodeGlPlatform } from "./gl-node.js";

let warned = false;

/**
 * Route `@smoove/transitions` Tier B (shader) transitions through a
 * headless-gl + skia compositor so they render in Node instead of falling back
 * to `fade()`. Idempotent. The GL context is created lazily on first use; if the
 * optional `gl` (headless-gl) package isn't installed the compositor resolves to
 * `null`, transitions still fall back to fade, and a one-time hint is logged.
 *
 * Call before building any `TransitionSeries`, or simply
 * `import "@smoove/renderer/gl"` (which calls this on load).
 */
export function enableNodeShaderTransitions(): void {
  setCompositorFactory(() => {
    const platform = createNodeGlPlatform();
    if (!platform) {
      if (!warned) {
        warned = true;
        console.warn(
          "@smoove/renderer: shader transitions need the optional `gl` (headless-gl) package — install it to render them, otherwise they fall back to fade().",
        );
      }
      return null;
    }
    return GlCompositor.fromPlatform(platform);
  });
}

enableNodeShaderTransitions();

/**
 * Route `@smoove/effects` node/layer effects and shader sources through the
 * same headless-gl + skia platform used for shader transitions, so they render
 * in Node. No-op (with the same one-time hint) when `gl` is missing, and
 * silently skipped when @smoove/effects isn't installed.
 *
 * Async because @smoove/effects is an optional ESM peer; `@smoove/renderer/gl`
 * awaits it at module top level, so `import "@smoove/renderer/gl"` is enough.
 */
export async function enableNodeShaderEffects(): Promise<void> {
  let effects: typeof import("@smoove/effects");
  try {
    effects = await import("@smoove/effects");
  } catch {
    return; // effects package not installed — nothing to wire
  }
  effects.setEffectPlatformFactory(() => {
    const platform = createNodeGlPlatform();
    if (!platform) {
      if (!warned) {
        warned = true;
        console.warn(
          "@smoove/renderer: shader transitions/effects need the optional `gl` (headless-gl) package — install it to render them, otherwise transitions fall back to fade() and nodes draw unfiltered.",
        );
      }
      return null;
    }
    // Swap in the effects' flip-aware vertex shader: transitions' vertex shader
    // hard-codes the V flip (fine for its single pass), but effect chains flip
    // only on the final pass — a baked-in flip inverts even-length chains.
    return { ...platform, vertexShader: effects.VERTEX_SHADER_100 };
  });
}

await enableNodeShaderEffects();
