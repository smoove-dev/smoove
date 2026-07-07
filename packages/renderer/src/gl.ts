import { EffectShaderRunner, setEffectShaderFactory } from "@smoove/core";
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

/**
 * Route `shader` effect passes (e.g. @smoove/effects' water) through
 * headless-gl as well. Idempotent. Each factory call builds its own GL
 * context, so transitions and effects don't share GL state.
 */
export function enableNodeShaderEffects(): void {
  setEffectShaderFactory(() => {
    const platform = createNodeGlPlatform();
    if (!platform) {
      if (!warned) {
        warned = true;
        console.warn(
          "@smoove/renderer: shader effects need the optional `gl` (headless-gl) package — install it to render them, otherwise those passes are skipped.",
        );
      }
      return null;
    }
    return EffectShaderRunner.fromPlatform(platform);
  });
}

enableNodeShaderTransitions();
enableNodeShaderEffects();
