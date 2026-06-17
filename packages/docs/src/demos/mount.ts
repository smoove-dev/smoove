// Browser-only: registers <km-player> and mounts a player into every demo slot
// that names a known composition. Loaded via dynamic import from an effect (see
// `use-demo-mounts.ts`) so the custom-element side effect never runs during SSR.
import "@konva-motion/player";
import { DEMO_URLS } from "./registry.js";

/**
 * Find `.demo-slot__stage[data-km-demo]` blocks in the server-rendered article
 * and drop a `<km-player src=…>` into each, pointing at the composition's `?url`.
 * Idempotent: a slot that already holds a player is skipped, so it's safe to run
 * on every route change.
 */
export function mountDemos(root: ParentNode = document): void {
  const stages = root.querySelectorAll<HTMLElement>(".demo-slot__stage[data-km-demo]");
  for (const stage of Array.from(stages)) {
    const id = stage.getAttribute("data-km-demo");
    const url = id ? DEMO_URLS[id] : undefined;
    if (!url || stage.querySelector("km-player")) continue;
    stage.replaceChildren();
    const player = document.createElement("km-player");
    player.setAttribute("controls", "");
    player.setAttribute("loop", "");
    player.setAttribute("src", url);
    stage.appendChild(player);
  }
}
