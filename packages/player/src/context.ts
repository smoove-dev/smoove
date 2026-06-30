import { createContext } from "@lit/context";
import type { PlayerApi } from "./player-api.js";

/**
 * Context token carrying the {@link PlayerApi}. `<smoove-player>` is the provider;
 * descendant controls may consume it with `@lit/context`'s `ContextConsumer`.
 * In light DOM the underlying `context-request` event bubbles through ordinary
 * DOM ancestors, so no shadow boundary is needed. Controls in this package use
 * the simpler {@link getPlayerApi} (`closest`) lookup, which also works when a
 * control is used without a context consumer.
 */
export const playerContext = createContext<PlayerApi>(Symbol("smoove-player"));

/** Resolve the nearest ancestor `<smoove-player>` as a {@link PlayerApi}. */
export function getPlayerApi(el: Element): PlayerApi | null {
  return el.closest("smoove-player") as unknown as PlayerApi | null;
}
