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
    const platform = createNodeGlPlatform({ rawReadback: true });
    if (!platform) {
      if (!warned) {
        warned = true;
        console.warn(
          "@smoove/renderer: shader transitions/effects need the optional `gl` (headless-gl) package — install it to render them, otherwise transitions fall back to fade() and nodes draw unfiltered.",
        );
      }
      return null;
    }
    // Adapt to the effects platform contract: the flip-aware vertex shader
    // (transitions' hard-codes the V flip; effect chains flip per pass),
    // flipFinalPass: false so the runtime renders the final pass un-flipped —
    // headless-gl's bottom-up readPixels then produces top-down data with no
    // CPU row-flip — and result() carrying the source-rect origin (always 0,0
    // here: readback canvases are exact-size).
    return {
      ...platform,
      vertexShader: effects.VERTEX_SHADER_100,
      flipFinalPass: false,
      result: (width: number, height: number) => ({
        image: platform.result(width, height),
        sx: 0,
        sy: 0,
      }),
    };
  });
}

await enableNodeShaderEffects();
