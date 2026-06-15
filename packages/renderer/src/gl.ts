import { GlCompositor, setCompositorFactory } from "@konva-motion/transitions";
import { createNodeGlPlatform } from "./gl-node.js";

let warned = false;

/**
 * Route `@konva-motion/transitions` Tier B (shader) transitions through a
 * headless-gl + skia compositor so they render in Node instead of falling back
 * to `fade()`. Idempotent. The GL context is created lazily on first use; if the
 * optional `gl` (headless-gl) package isn't installed the compositor resolves to
 * `null`, transitions still fall back to fade, and a one-time hint is logged.
 *
 * Call before building any `TransitionSeries`, or simply
 * `import "@konva-motion/renderer/gl"` (which calls this on load).
 */
export function enableNodeShaderTransitions(): void {
  setCompositorFactory(() => {
    const platform = createNodeGlPlatform();
    if (!platform) {
      if (!warned) {
        warned = true;
        console.warn(
          "@konva-motion/renderer: shader transitions need the optional `gl` (headless-gl) package — install it to render them, otherwise they fall back to fade().",
        );
      }
      return null;
    }
    return GlCompositor.fromPlatform(platform);
  });
}

enableNodeShaderTransitions();
